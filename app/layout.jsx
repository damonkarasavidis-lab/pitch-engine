import './globals.css'

export const metadata = {
  title:       'Pitch Engine',
  description: 'Mobile-native story decks',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/*
        viewport-fit=cover is essential — tells iOS Safari to render
        under the notch/Dynamic Island so our safe-area-inset-* CSS
        variables have accurate values.
      */}
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  )
}
