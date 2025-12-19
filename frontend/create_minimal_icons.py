#!/usr/bin/env python3
"""
Create minimal placeholder PNG icons using base64 encoded 1x1 pixel PNG
This creates valid PNG files that will stop 404 errors
"""

import base64
import os

# Minimal valid 1x1 pixel red PNG (we'll scale it)
MINIMAL_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

sizes = [72, 96, 128, 144, 152, 192, 384, 512]

os.makedirs('icons', exist_ok=True)

# Decode the minimal PNG
png_data = base64.b64decode(MINIMAL_PNG_BASE64)

# For each size, write a minimal PNG file
# In a real scenario, you'd scale/resize, but for now just create valid PNGs
# Using PIL would be better, but this at least creates files that won't 404

print("Creating minimal placeholder icons...")
for size in sizes:
    filename = f'icons/icon-{size}x{size}.png'
    
    # Write minimal PNG (will be 1x1 but at least won't 404)
    with open(filename, 'wb') as f:
        f.write(png_data)
    
    print(f"Created {filename} (minimal placeholder)")

print("\n✅ Placeholder icons created!")
print("⚠️  These are minimal 1x1 pixel icons. For proper icons, use:")
print("   1. Run: pip install Pillow")
print("   2. Run: python create_icons.py")
print("   3. Or use an online PWA icon generator")

