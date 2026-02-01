import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import productsRoutes from "./routes/products.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploads publicly
app.use("/uploads", express.static(path.resolve("uploads")));

// Health Check Route
app.get("/api/health", async (req, res) => {
  try {
    const dbCheck = await query("SELECT NOW()"); 
    res.json({
      status: "Online",
      database: "Connected",
      server_time: dbCheck.rows[0].now,
      environment: process.env.NODE_ENV || "development"
    });
  } catch (err) {
    res.status(500).json({
      status: "Error",
      database: "Disconnected",
      error: err.message
    });
  }
});

app.get("/", (_, res) => res.send("Backend is running ✅"));
app.use("/api/products", productsRoutes);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`✅ API running at http://localhost:${port}`));

export default app;