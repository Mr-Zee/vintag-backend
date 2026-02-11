import express from "express";
import multer from "multer";
import sharp from 'sharp';
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { query } from "../db.js";

const router = express.Router();

// 1. Switch to Memory Storage so Sharp can access the file buffer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } 
});

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Helper function to process and upload to S3
const processAndUpload = async (file) => {
  const fileName = `products/${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  
  // Convert to WebP using Sharp
  const webpBuffer = await sharp(file.buffer)
    .webp({ quality: 80 })
    .toBuffer();

  // Manual Upload to S3
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileName,
    Body: webpBuffer,
    ContentType: "image/webp",
    // ACL: "public-read", // Uncomment if your bucket requires this for public links
  }));

  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
};

// POST: Create product with WebP conversion
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image is required" });

    const imageUrl = await processAndUpload(req.file);
    const { title, material, code, badge, description } = req.body;

    const insert = await query(
      `INSERT INTO products (title, material, reviews, image, badge, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, material, code, imageUrl, badge, description],
    );

    res.json(insert.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create product", error: err.message });
  }
});

// PUT: Update product with WebP conversion
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, material, code, badge, description } = req.body;
    
    let imageUrl = req.body.image;

    if (req.file) {
      imageUrl = await processAndUpload(req.file);
    }

    const result = await query(
      `UPDATE products 
       SET title = $1, material = $2, reviews = $3, image = $4, badge = $5, description = $6 
       WHERE id = $7 RETURNING *`,
      [title, material, code, imageUrl, badge, description, id],
    );

    if (result.rows.length === 0) return res.status(404).json({ message: "Product not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// GET: All products
router.get("/", async (req, res) => {
  try {
    const result = await query("SELECT * FROM products ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load products", error: err.message });
  }
});

// DELETE: Product and S3 Image
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const productResult = await query("SELECT image FROM products WHERE id = $1", [id]);

    if (productResult.rows.length > 0) {
      const imageUrl = productResult.rows[0].image;
      const s3Key = imageUrl.split(".com/")[1];

      if (s3Key) {
        try {
          await s3.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: decodeURIComponent(s3Key),
          }));
        } catch (s3Err) {
          console.error("❌ S3 Delete Failed:", s3Err.message);
        }
      }
    }

    await query("DELETE FROM products WHERE id=$1", [id]);
    res.json({ ok: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete", error: err.message });
  }
});

export default router;