export const VIDEO_LEFT =
  'https://d8j0ntlcm91z4.cloudfront.net/user_39ca84eAE1ODL9hbR5VhoEj8tBf/hf_20260625_154433_532a85d3-dabf-4265-b8bd-19ac6af31842.mp4'

export const VIDEO_RIGHT =
  'https://d8j0ntlcm91z4.cloudfront.net/user_39ca84eAE1ODL9hbR5VhoEj8tBf/hf_20260625_154401_a664f076-b971-4557-8728-40ef9ea4c49b.mp4'

export const GALLERY_IMAGES = [
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_104530_521b2f85-c0f3-4d0e-9704-b578315b4cb9.png&w=1920&q=85',
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103711_76ccdb8b-5043-4f47-9c54-4379713393ea.png&w=1920&q=85',
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103728_394f6a1b-85e2-4386-a4f6-408472a0a5b7.png&w=1920&q=85',
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103739_86743e0e-16a7-4bee-bf38-dd67985344dc.png&w=1920&q=85',
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103748_b2215dc8-a3a7-470d-b19a-5b87fa7d0c37.png&w=1920&q=85',
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103758_e919ce72-5c9d-4b87-9be6-d7647b34825c.png&w=1920&q=85',
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103808_013583d0-3386-4547-9832-37c7d8edb3ac.png&w=1920&q=85',
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103937_a0c49d0a-33eb-4ead-aea6-c1baf241acbc.png&w=1920&q=85',
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103956_d18ed8fd-7b6f-4b86-91f9-20010fe38670.png&w=1920&q=85',
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_104034_ba5a9963-87ff-4008-a545-6bd686c088b5.png&w=1920&q=85',
] as const

export type GalleryTile = {
  src: string
  colStart: number
  colSpan: number
  rowStart: number
  rowSpan: number
  aspect: number
  initialScale: number
}

export const GALLERY_LAYOUT: GalleryTile[] = [
  { src: GALLERY_IMAGES[0], colStart: 2,  colSpan: 4, rowStart: 1,  rowSpan: 3, aspect: 4 / 5,  initialScale: 0.6 },
  { src: GALLERY_IMAGES[1], colStart: 8,  colSpan: 3, rowStart: 2,  rowSpan: 2, aspect: 3 / 4,  initialScale: 0.7 },
  { src: GALLERY_IMAGES[2], colStart: 1,  colSpan: 3, rowStart: 5,  rowSpan: 2, aspect: 4 / 3,  initialScale: 0.5 },
  { src: GALLERY_IMAGES[3], colStart: 5,  colSpan: 4, rowStart: 5,  rowSpan: 3, aspect: 4 / 5,  initialScale: 0.6 },
  { src: GALLERY_IMAGES[4], colStart: 10, colSpan: 3, rowStart: 6,  rowSpan: 2, aspect: 3 / 4,  initialScale: 0.65 },
  { src: GALLERY_IMAGES[5], colStart: 3,  colSpan: 3, rowStart: 9,  rowSpan: 2, aspect: 3 / 4,  initialScale: 0.55 },
  { src: GALLERY_IMAGES[6], colStart: 7,  colSpan: 5, rowStart: 9,  rowSpan: 3, aspect: 5 / 4,  initialScale: 0.7 },
  { src: GALLERY_IMAGES[7], colStart: 2,  colSpan: 4, rowStart: 12, rowSpan: 3, aspect: 4 / 5,  initialScale: 0.6 },
  { src: GALLERY_IMAGES[8], colStart: 8,  colSpan: 4, rowStart: 13, rowSpan: 2, aspect: 4 / 3,  initialScale: 0.55 },
  { src: GALLERY_IMAGES[9], colStart: 4,  colSpan: 5, rowStart: 16, rowSpan: 3, aspect: 4 / 5,  initialScale: 0.65 },
]
