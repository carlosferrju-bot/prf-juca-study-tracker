import { currentUser } from './_auth.js';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    disciplines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          topics: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                topic: { type: 'string' },
                notes: { type: 'string' }
              },
              required: ['topic', 'notes']
            }
          }
        },
        required: ['name', 'topics']
      }
    }
  },
  required: ['disciplines']
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ ok: false, code: 'OPENAI_NOT_CONFIGURED', message: 'A leitura por IA ainda não está configurada. Adicione OPENAI_API_KEY nas variáveis da Vercel.' });

  const user = await currentUser(req);
  if (!user) return res.status(401).json({ ok: false, message: 'Faça login para usar a leitura por IA.' });

  try {
    const image = String(req.body?.image || '');
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(image)) {
      return res.status(400).json({ ok: false, message: 'Envie uma imagem PNG, JPG ou WEBP válida.' });
    }
    if (image.length > 18_000_000) return res.status(413).json({ ok: false, message: 'Imagem muito grande. Envie uma foto com tamanho menor.' });

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_EDITAL_MODEL || 'gpt-5.6-luna',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: 'Leia cuidadosamente esta imagem de edital de concurso. Extraia SOMENTE o que estiver visível e organize a hierarquia em disciplinas e tópicos. Não invente, complete ou corrija conteúdo que não esteja legível. Preserve a numeração quando ela fizer parte do texto. Se uma disciplina aparecer sem tópicos visíveis, retorne a disciplina com topics vazio. Em notes, registre apenas observações realmente presentes na imagem; caso não existam, use string vazia.' },
            { type: 'input_image', image_url: image }
          ]
        }],
        text: { format: { type: 'json_schema', name: 'edital_import', strict: true, schema } },
        max_output_tokens: 12000
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[PRF JUCA AI EDITAL]', data);
      return res.status(502).json({ ok: false, message: data?.error?.message || 'A IA não conseguiu analisar a imagem.' });
    }

    let parsed;
    try { parsed = JSON.parse(data.output_text || '{}'); }
    catch { return res.status(502).json({ ok: false, message: 'A IA retornou uma estrutura inválida. Tente uma imagem mais nítida.' }); }

    return res.status(200).json({ ok: true, result: parsed, model: process.env.OPENAI_EDITAL_MODEL || 'gpt-5.6-luna' });
  } catch (error) {
    console.error('[PRF JUCA AI EDITAL]', error);
    return res.status(500).json({ ok: false, message: 'Não foi possível processar o edital por IA.' });
  }
}
