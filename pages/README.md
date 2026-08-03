# Filling a board page in

Each page reads a list from `<board>.txt` here and shows the pictures from
`assets/boards/<board>/` under it. One line per picture:

    file.jpg | The caption under it

Lines starting with `#` and blank lines are skipped. Boards: `o m a i b faq
rules`. Drop the picture into `assets/boards/<board>/`, add its line, done.

`i.txt` is laid out staggered and reshuffled on every visit; the others keep the
order of the file. Which is which is set in `board_gallery()` in `api/ui.php`.

For a page that needs more than pictures, put an HTML fragment in
`<board>.html` instead - it is pasted in as it stands, above the gallery.
