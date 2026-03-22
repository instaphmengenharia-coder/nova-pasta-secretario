export default async function handler(req, res) {
  try {
    const url = 'https://raw.githubusercontent.com/instaphmengenharia-coder/secretario-extension/master/instalar.bat'
    const r = await fetch(url)
    if (!r.ok) throw new Error(`GitHub retornou ${r.status}`)
    const text = await r.text()
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', 'attachment; filename="instalar.bat"')
    res.setHeader('Cache-Control', 'no-cache')
    res.status(200).end(text)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
