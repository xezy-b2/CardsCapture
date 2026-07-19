const express = require('express');
const router = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';

// URL complète du site GitHub Pages (avec le sous-chemin /CardsCapture/),
// utilisée pour renvoyer l'utilisateur au bon endroit après le login Discord.
// Différent de FRONTEND_ORIGIN (server.js) qui doit rester sans chemin pour CORS.
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://xezy-b2.github.io/CardsCapture/';

router.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify'
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${FRONTEND_URL}?erreur=connexion_annulee`);

  try {
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      })
    });

    if (!tokenRes.ok) {
      if (tokenRes.status === 429) {
        const retryAfter = tokenRes.headers.get('retry-after');
        const resetAfter = tokenRes.headers.get('x-ratelimit-reset-after');
        const bucket = tokenRes.headers.get('x-ratelimit-bucket');
        console.error(`[Rate limit Discord] retry-after=${retryAfter}s | reset-after=${resetAfter}s | bucket=${bucket}`);
      }
      throw new Error(`Échange de token échoué (${tokenRes.status})`);
    }
    const tokenData = await tokenRes.json();

    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userRes.ok) throw new Error(`Récupération du profil échouée (${userRes.status})`);
    const discordUser = await userRes.json();

    req.session.user = {
      id: discordUser.id,
      username: discordUser.username,
      avatarUrl: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.discriminator || 0) % 5}.png`
    };

    res.redirect(FRONTEND_URL);
  } catch (err) {
    console.error('Erreur OAuth Discord :', err.message);
    res.redirect(`${FRONTEND_URL}?erreur=connexion_echouee`);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect(FRONTEND_URL));
});

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

module.exports = router;
