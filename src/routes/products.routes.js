import express from "express";
import multer from "multer";
import path from "path";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import multerS3 from "multer-s3";
import { query } from "../db.js";

const router = express.Router();

// 1. Initialize S3 Client using credentials from .env
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 2. Configure Multer to stream directly to S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: "public-read",
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      const safeName = `products/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// UPDATE product
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, material, code, badge } = req.body;
    let imageUrl = req.file ? req.file.location : req.body.image;

    const result = await query(
      `UPDATE products 
       SET title = $1, material = $2, reviews = $3, image = $4, badge = $5 
       WHERE id = $6 RETURNING *`,
      [title, material, code, imageUrl, badge, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// GET all products
router.get("/", async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM products ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to load products", error: err.message });
  }
});

// POST create product
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "Image is required" });

    const imageUrl = req.file.location; // Permanent S3 URL

    const { title, material, code, badge } = req.body;

    const insert = await query(
      `INSERT INTO products 
        (title, material, reviews, image, badge)
       VALUES 
        ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, material, code, imageUrl, badge],
    );

    res.json(insert.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Failed to create product", error: err.message });
  }
});

// DELETE product
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get the image URL from the database before deleting the record
    const productResult = await query(
      "SELECT image FROM products WHERE id = $1",
      [id],
    );

    if (productResult.rows.length > 0) {
      const imageUrl = productResult.rows[0].image;

      // 2. Extract the S3 Key from the URL
      // URL format: https://bucket-name.s3.region.amazonaws.com/products/123.jpg
      // We need: products/123.jpg
      const urlParts = imageUrl.split(".com/");
      const s3Key = urlParts[1];

      if (s3Key) {
        try {
          const deleteParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: decodeURIComponent(s3Key), // decode in case of spaces/special chars
          };
          await s3.send(new DeleteObjectCommand(deleteParams));
          console.log("✅ Image deleted from S3:", s3Key);
        } catch (s3Err) {
          console.error("❌ Failed to delete image from S3:", s3Err.message);
          // We continue anyway so the DB record gets deleted
        }
      }
    }

    // 3. Delete the record from the Database
    await query("DELETE FROM products WHERE id=$1", [id]);
    res.json({ ok: true, message: "Product and image deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete product", error: err.message });
  }
});

export default router;