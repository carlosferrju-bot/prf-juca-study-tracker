const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const dir = path.join(__dirname, '..', 'assets', 'prf-juca-police-bg-b64');
    const parts = ['01.txt', '02.txt', '03.txt'].map(name => fs.readFileSync(path.join(dir, name), 'utf8').trim());
    const image = Buffer.from(parts.join(''), 'base64');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(image);
  } catch (error) {
    console.error('Falha ao montar background:', error);
    res.status(500).json({ error: 'Não foi possível carregar o background.' });
  }
};
