import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import productsRoutes from "./routes/products.routes.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    "https://vintag.ae", 
    "https://vintage-teal.vercel.app", 
    "http://localhost:4000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

app.use("/uploads", express.static(path.resolve("uploads")));

app.get("/", (_, res) => res.send("Backend is running ✅"));
app.use("/api/products", productsRoutes);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`✅ API running at http://localhost:${port}`));

export default app;