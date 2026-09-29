import { createApp } from './app';

const app = createApp();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(PORT, () => {
  console.log(`[Server] FIAP Chat Notifications API ouvindo na porta ${PORT}`);
  console.log(`[Server] Health check acessível em http://localhost:${PORT}/health`);
});
