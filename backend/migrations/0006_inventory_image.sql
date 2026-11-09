-- Add image_url column to inventory_items for product photos
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS image_url text;
