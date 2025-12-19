#!/usr/bin/env python
"""Create simple placeholder icons for the PWA"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
except ImportError:
    print("Pillow not installed. Installing...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'Pillow'])
    from PIL import Image, ImageDraw, ImageFont
    import os

# Icon sizes needed
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

# Theme color (dark green)
color = (44, 85, 48)  # #2C5530

# Create icons directory if it doesn't exist
os.makedirs('icons', exist_ok=True)

for size in sizes:
    # Create image with theme color
    img = Image.new('RGB', (size, size), color=color)
    
    # Add a simple music note symbol (🎵) if size is large enough
    if size >= 96:
        draw = ImageDraw.Draw(img)
        try:
            # Try to use a system font
            font_size = size // 3
            try:
                font = ImageFont.truetype("arial.ttf", font_size)
            except:
                try:
                    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", font_size)
                except:
                    font = ImageFont.load_default()
            
            # Draw a simple "M" for Music (or you could draw a note symbol)
            text = "🎵" if size >= 192 else "M"
            # Get text bounding box
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            # Center the text
            position = ((size - text_width) // 2, (size - text_height) // 2)
            draw.text(position, text, fill=(255, 255, 255), font=font)
        except Exception as e:
            print(f"Could not add text to {size}x{size} icon: {e}")
            # Just use solid color if text fails
    
    # Save icon
    filename = f'icons/icon-{size}x{size}.png'
    img.save(filename)
    print(f"Created {filename}")

print("\n✅ All icons created successfully!")
print("Note: These are placeholder icons. Replace with proper app icons later.")

