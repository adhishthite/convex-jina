import { defineApp } from "convex/server";
import jina from "../../src/component/convex.config";

// Define the app with explicit return type to avoid import path issues
const app = defineApp() as ReturnType<typeof defineApp>;

// Install the Jina component
app.use(jina);

export default app;
