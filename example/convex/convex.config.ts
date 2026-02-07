import { defineApp } from "convex/server";
import jina from "../../src/component/convex.config.js";

const app = defineApp();
app.use(jina);
export default app;
