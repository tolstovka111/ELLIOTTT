"""
Fake Stars — плагин для exteraGram.

Локально (только на вашем устройстве) подменяет отображаемый баланс Telegram Stars
и позволяет «оплачивать» звёздами — запросы оплаты не уходят на сервер, вместо них
плагин отдаёт приложению поддельный успешный ответ.

Ничего из этого не меняет реальный баланс на серверах Telegram и не видно
собеседникам: это чисто визуальная песочница для себя.
"""

__id__ = "fake_stars"
__name__ = "Fake Stars"
__description__ = (
    "Показывает любое количество звёзд, которое вы зададите, и даёт «оплачивать» ими. "
    "Работает только локально, на вашем экране."
)
__author__ = "@ELLIOTTT"
__version__ = "1.0.0"
__icon__ = "exteraPlugins/1"
__app_version__ = ">=11.9.0"
__min_version__ = "11.9.0"

import time
from typing import Any, List

from base_plugin import BasePlugin, HookResult, HookStrategy, MethodHook
from ui.settings import Divider, Header, Input, Selector, Switch, Text
from ui.bulletin import BulletinHelper
from android_utils import log, run_on_ui_thread
from client_utils import get_notification_center
from hook_utils import find_class, get_static_private_field, set_private_field
from java import jarray, jclass

# ---------------------------------------------------------------------------
# Константы
# ---------------------------------------------------------------------------

DEFAULT_BALANCE = "1000000"
MAX_BALANCE = 4_000_000_000_000_000_000  # с запасом влезает в java long

PRESETS = ["Своё значение", "1 000", "10 000", "100 000", "1 000 000", "1 000 000 000"]
PRESET_VALUES = [None, 1_000, 10_000, 100_000, 1_000_000, 1_000_000_000]

# Класс с балансом звёзд. Имя пакета не менялось начиная с 10.x, но на всякий
# случай перебираем несколько вариантов.
STARS_CONTROLLER_CLASSES = (
    "org.telegram.ui.Stars.StarsController",
    "org.telegram.ui.Stars.StarsController$Companion",
)

# Методы StarsController, результат которых мы подменяем.
BALANCE_METHODS = ("getBalance", "getBalanceAmount", "getStarsBalance")
AVAILABILITY_METHODS = ("balanceAvailable", "isBalanceAvailable")

# TL_stars.StarsAmount — объект баланса {amount: long, nanos: int}.
STARS_AMOUNT_CLASSES = (
    "org.telegram.tgnet.tl.TL_stars$StarsAmount",
    "org.telegram.tgnet.tl.TL_stars$TL_starsAmount",
    "org.telegram.tgnet.TLRPC$TL_starsAmount",
)

# Ответы, внутри которых сервер присылает баланс (поле balance).
BALANCE_RESPONSES = (
    "TL_payments_getStarsStatus",
    "TL_payments_getStarsTransactions",
    "TL_payments_getStarsTransactionsByID",
    "TL_payments_getStarsSubscriptions",
)

# Запросы, которые списывают настоящие звёзды. Именно их мы перехватываем.
PAYMENT_REQUESTS = (
    "TL_payments_sendStarsForm",     # покупка, подарок, платные медиа
    "TL_messages_sendPaidReaction",  # платные реакции
)


def _parse_amount(value: Any, default: int = 0) -> int:
    """Достаёт целое число из строки настроек ('1 000 000' -> 1000000)."""
    try:
        digits = "".join(ch for ch in str(value) if ch.isdigit())
        if not digits:
            return default
        return max(0, min(int(digits), MAX_BALANCE))
    except Exception:
        return default


def _java_long(value: int):
    try:
        return jclass("java.lang.Long")(int(value))
    except Exception:
        return int(value)


def _java_bool(value: bool):
    try:
        return jclass("java.lang.Boolean")(bool(value))
    except Exception:
        return bool(value)


def _jclass_or_none(name: str):
    try:
        return jclass(name)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Xposed-хуки
# ---------------------------------------------------------------------------


class BalanceHook(MethodHook):
    """Подменяет то, что StarsController.getBalance() возвращает интерфейсу."""

    def __init__(self, plugin: "FakeStarsPlugin"):
        self.plugin = plugin

    def after_hooked_method(self, param):
        try:
            if not self.plugin.override_enabled():
                return
            amount = self.plugin.fake_amount()
            result = param.getResult()

            if result is None:
                created = self.plugin.build_stars_amount(amount)
                if created is not None:
                    param.setResult(created)
                else:
                    param.setResult(_java_long(amount))
                return

            # Старые сборки: getBalance() -> long
            if isinstance(result, int) and not isinstance(result, bool):
                param.setResult(_java_long(amount))
                return

            # Новые сборки: getBalance() -> TL_stars.StarsAmount
            if not self.plugin.patch_stars_amount(result, amount):
                created = self.plugin.build_stars_amount(amount)
                if created is not None:
                    param.setResult(created)
        except Exception as e:
            log(f"[fake_stars] balance hook error: {e}")


class BalanceAvailableHook(MethodHook):
    """Чтобы шторки со звёздами не висели в состоянии «загрузка баланса»."""

    def __init__(self, plugin: "FakeStarsPlugin"):
        self.plugin = plugin

    def after_hooked_method(self, param):
        try:
            if self.plugin.override_enabled():
                param.setResult(_java_bool(True))
        except Exception as e:
            log(f"[fake_stars] availability hook error: {e}")


# ---------------------------------------------------------------------------
# Плагин
# ---------------------------------------------------------------------------


class FakeStarsPlugin(BasePlugin):

    def on_plugin_load(self):
        self._unhooks = []
        self._form_prices = {}

        self._install_method_hooks()

        for name in BALANCE_RESPONSES:
            self.add_hook(name)
        for name in PAYMENT_REQUESTS:
            self.add_hook(name)
        self.add_hook("TL_payments_getPaymentForm")
        # updateStarsBalance / TL_updateStarsBalance — апдейт баланса с сервера
        self.add_hook("updateStarsBalance", match_substring=True)

        self.log(f"loaded, fake balance = {self.fake_amount()}")
        self.apply_balance_now(silent=True)

    def on_plugin_unload(self):
        for unhook in self._unhooks:
            try:
                self.unhook_method(unhook)
            except Exception:
                pass
        self._unhooks = []

        for name in BALANCE_RESPONSES + PAYMENT_REQUESTS:
            try:
                self.remove_hook(name)
            except Exception:
                pass
        for name in ("TL_payments_getPaymentForm", "updateStarsBalance"):
            try:
                self.remove_hook(name)
            except Exception:
                pass

    # -- настройки ---------------------------------------------------------

    def create_settings(self) -> List[Any]:
        return [
            Header(text="Баланс"),
            Switch(
                key="enabled",
                text="Подменять баланс звёзд",
                default=True,
                subtext="Везде в приложении будет показано ваше число",
            ),
            Input(
                key="balance",
                text="Количество звёзд",
                default=DEFAULT_BALANCE,
                subtext="Только цифры",
                on_change=self._on_balance_input,
            ),
            Selector(
                key="preset",
                text="Быстрый выбор",
                default=0,
                items=PRESETS,
                on_change=self._on_preset,
            ),
            Text(
                text="Применить сейчас",
                accent=True,
                on_click=lambda view: self.apply_balance_now(),
            ),
            Divider(
                text="Число хранится только в памяти телефона. На серверах Telegram "
                     "ваш настоящий баланс не меняется, и другие люди видят его как есть."
            ),

            Header(text="Оплата звёздами"),
            Switch(
                key="fake_payments",
                text="Фейковая оплата",
                default=True,
                subtext="Покупки, подарки и платные реакции «проходят» локально: "
                        "запрос на сервер не отправляется",
            ),
            Switch(
                key="spend",
                text="Списывать с фейкового баланса",
                default=True,
                subtext="После каждой «оплаты» локальное число уменьшается на цену",
            ),
            Switch(
                key="notify",
                text="Уведомлять об «оплате»",
                default=True,
                subtext="Показывать плашку с суммой",
            ),
            Divider(
                text="Настоящие звёзды при этом не тратятся: перехваченный запрос "
                     "никуда не уходит, поэтому подарок или покупка существует только "
                     "у вас на экране. Покупка самих звёзд за деньги не трогается."
            ),
        ]

    def _on_balance_input(self, new_value: str):
        cleaned = str(_parse_amount(new_value, 0))
        if cleaned != str(new_value).strip():
            self.set_setting("balance", cleaned, reload_settings=True)
        self.apply_balance_now(silent=True)

    def _on_preset(self, index: int):
        try:
            value = PRESET_VALUES[index]
        except Exception:
            value = None
        if value is None:
            return
        self.set_setting("balance", str(value), reload_settings=True)
        self.apply_balance_now()

    # -- состояние ---------------------------------------------------------

    def override_enabled(self) -> bool:
        return bool(self.get_setting("enabled", True))

    def fake_amount(self) -> int:
        return _parse_amount(self.get_setting("balance", DEFAULT_BALANCE),
                             _parse_amount(DEFAULT_BALANCE))

    def set_fake_amount(self, value: int):
        self.set_setting("balance", str(max(0, min(int(value), MAX_BALANCE))),
                         reload_settings=True)

    # -- работа с TL_stars.StarsAmount -------------------------------------

    def patch_stars_amount(self, obj, amount: int) -> bool:
        """Правит поля amount/nanos прямо в объекте баланса."""
        if obj is None:
            return False
        try:
            obj.amount = amount
            try:
                obj.nanos = 0
            except Exception:
                pass
            return True
        except Exception:
            pass
        ok = False
        try:
            ok = bool(set_private_field(obj, "amount", amount))
            set_private_field(obj, "nanos", 0)
        except Exception:
            pass
        return ok

    def build_stars_amount(self, amount: int):
        for name in STARS_AMOUNT_CLASSES:
            cls = _jclass_or_none(name)
            if cls is None:
                continue
            try:
                return cls.ofStars(amount)
            except Exception:
                pass
            try:
                obj = cls()
                if self.patch_stars_amount(obj, amount):
                    return obj
            except Exception:
                continue
        return None

    # -- xposed ------------------------------------------------------------

    def _install_method_hooks(self):
        balance_hook = BalanceHook(self)
        available_hook = BalanceAvailableHook(self)

        for class_name in STARS_CONTROLLER_CLASSES:
            clazz = find_class(class_name)
            if clazz is None:
                continue
            for method in BALANCE_METHODS:
                self._hook_all(clazz, method, balance_hook)
            for method in AVAILABILITY_METHODS:
                self._hook_all(clazz, method, available_hook)

    def _hook_all(self, clazz, method_name: str, hook):
        try:
            unhooks = self.hook_all_methods(clazz, method_name, hook)
        except Exception as e:
            log(f"[fake_stars] cannot hook {method_name}: {e}")
            return
        if unhooks:
            self._unhooks.extend(list(unhooks))

    # -- обновление интерфейса --------------------------------------------

    def apply_balance_now(self, silent: bool = False):
        """Пишет фейковое число прямо в StarsController и просит UI перерисоваться."""
        amount = self.fake_amount()
        if self.override_enabled():
            self._write_controller_balance(amount)
        self._post_balance_updated()
        if not silent:
            self._show(f"Баланс: {amount:,}".replace(",", " ") + " ⭐", success=True)

    def _write_controller_balance(self, amount: int):
        try:
            account = jclass("org.telegram.messenger.UserConfig").selectedAccount
        except Exception:
            account = 0
        for class_name in STARS_CONTROLLER_CLASSES:
            cls = _jclass_or_none(class_name)
            if cls is None:
                continue
            try:
                instance = cls.getInstance(account)
            except Exception:
                continue
            if instance is None:
                continue
            try:
                current = getattr(instance, "balance", None)
            except Exception:
                current = None
            if current is not None and not isinstance(current, (int, bool)):
                self.patch_stars_amount(current, amount)
            else:
                created = self.build_stars_amount(amount)
                try:
                    instance.balance = created if created is not None else amount
                except Exception:
                    set_private_field(instance, "balance",
                                      created if created is not None else amount)
            return

    def _post_balance_updated(self):
        def _run():
            try:
                nc_class = find_class("org.telegram.messenger.NotificationCenter")
                if nc_class is None:
                    return
                event_id = get_static_private_field(nc_class, "starBalanceUpdated")
                if event_id is None:
                    return
                empty = jarray(jclass("java.lang.Object"))([])
                get_notification_center().postNotificationName(event_id, empty)
            except Exception as e:
                log(f"[fake_stars] cannot post balance update: {e}")

        run_on_ui_thread(_run)

    def _show(self, text: str, success: bool = False):
        def _run():
            try:
                if success:
                    BulletinHelper.show_success(text)
                else:
                    BulletinHelper.show_info(text)
            except Exception:
                pass

        run_on_ui_thread(_run)

    # -- сетевые хуки ------------------------------------------------------

    def post_request_hook(self, request_name: str, account: int, response: Any,
                          error: Any) -> HookResult:
        try:
            if response is None:
                return HookResult()

            if request_name == "TL_payments_getPaymentForm":
                self._remember_form_price(response)
                return HookResult()

            if not self.override_enabled():
                return HookResult()

            if request_name in BALANCE_RESPONSES:
                self._patch_balance_field(response)
        except Exception as e:
            log(f"[fake_stars] post_request_hook error: {e}")
        return HookResult()

    def on_update_hook(self, update_name: str, account: int, update: Any) -> HookResult:
        try:
            if self.override_enabled() and "StarsBalance" in str(update_name):
                self._patch_balance_field(update)
        except Exception as e:
            log(f"[fake_stars] on_update_hook error: {e}")
        return HookResult()

    def pre_request_hook(self, request_name: str, account: int, request: Any) -> HookResult:
        try:
            if request_name not in PAYMENT_REQUESTS:
                return HookResult()
            if not bool(self.get_setting("fake_payments", True)):
                return HookResult()

            price = self._price_of(request_name, request)
            fake_response = self._build_fake_response(request_name)

            self._after_fake_payment(price)

            if fake_response is not None:
                return HookResult(strategy=HookStrategy.MODIFY_FINAL,
                                  response=fake_response)
            # Не смогли собрать ответ — просто не отправляем запрос.
            return HookResult(strategy=HookStrategy.CANCEL)
        except Exception as e:
            log(f"[fake_stars] pre_request_hook error: {e}")
            return HookResult()

    # -- вспомогательное для сетевых хуков ---------------------------------

    def _patch_balance_field(self, obj):
        """Подменяет поле balance в ответе/апдейте сервера."""
        try:
            balance = getattr(obj, "balance", None)
        except Exception:
            balance = None
        amount = self.fake_amount()
        if balance is not None and not isinstance(balance, (int, bool)):
            self.patch_stars_amount(balance, amount)
            return
        # старый формат: balance — просто long
        try:
            obj.balance = amount
        except Exception:
            set_private_field(obj, "balance", amount)

    def _remember_form_price(self, response):
        """Запоминает цену формы оплаты, чтобы потом списать её с фейкового баланса."""
        try:
            form_id = int(getattr(response, "form_id", 0) or 0)
            invoice = getattr(response, "invoice", None)
            if invoice is None:
                return
            prices = getattr(invoice, "prices", None)
            total = 0
            if prices is not None:
                for i in range(prices.size()):
                    total += int(getattr(prices.get(i), "amount", 0) or 0)
            if total <= 0:
                return
            if len(self._form_prices) > 64:
                self._form_prices.clear()
            self._form_prices[form_id] = total
        except Exception as e:
            log(f"[fake_stars] cannot read form price: {e}")

    def _price_of(self, request_name: str, request) -> int:
        try:
            if request_name == "TL_messages_sendPaidReaction":
                return max(0, int(getattr(request, "count", 0) or 0))
            form_id = int(getattr(request, "form_id", 0) or 0)
            return int(self._form_prices.pop(form_id, 0))
        except Exception:
            return 0

    def _build_fake_response(self, request_name: str):
        updates = self._build_empty_updates()
        if request_name == "TL_messages_sendPaidReaction":
            return updates
        payment_result = _jclass_or_none("org.telegram.tgnet.TLRPC$TL_payments_paymentResult")
        if payment_result is None or updates is None:
            return updates
        try:
            result = payment_result()
            result.updates = updates
            return result
        except Exception as e:
            log(f"[fake_stars] cannot build payment result: {e}")
            return None

    def _build_empty_updates(self):
        cls = _jclass_or_none("org.telegram.tgnet.TLRPC$TL_updates")
        if cls is None:
            return None
        try:
            updates = cls()
            try:
                updates.date = int(time.time())
                updates.seq = 0
            except Exception:
                pass
            return updates
        except Exception as e:
            log(f"[fake_stars] cannot build updates: {e}")
            return None

    def _after_fake_payment(self, price: int):
        if price > 0 and bool(self.get_setting("spend", True)):
            new_balance = max(0, self.fake_amount() - price)
            self.set_fake_amount(new_balance)
            self._write_controller_balance(new_balance)
            self._post_balance_updated()

        if bool(self.get_setting("notify", True)):
            if price > 0:
                text = f"«Оплачено» {price} ⭐ — только у вас на экране"
            else:
                text = "«Оплачено» — только у вас на экране"
            self._show(text, success=True)
