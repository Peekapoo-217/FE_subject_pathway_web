export const environment = {
  production: true,
  API_URL: '', // Production reverse proxy routes /api/v1 to Spring Boot.
  RAG_API_URL: 'http://localhost:8000/api/chat',
  DEFAULT_LLM_MODEL: 'claude-3-5-sonnet-20241022'
};
