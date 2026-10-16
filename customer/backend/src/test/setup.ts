process.env.DATABASE_URL ??= "mongodb://127.0.0.1:27017/iyalvi-test";
process.env.PORT ??= "5000";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";
process.env.CLIENT_URL ??= "http://localhost:8080";
process.env.NODE_ENV = "test";
