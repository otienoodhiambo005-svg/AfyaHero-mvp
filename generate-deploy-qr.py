#!/usr/bin/env python3
"""
AfyaHero Google Cloud Deployment QR Code Generator
Generates scannable QR code that opens direct GCP deployment
"""

import qrcode
import qrcode.image.svg
from qrcode.image.pure import PyPNGImage
import sys

def generate_qr(output_file="deploy-qrcode.png"):
    # Direct Google Cloud deployment URL
    deploy_url = "https://console.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https://github.com/AfyaVerse-stack/AfyaHero-Health.git&cloudshell_workspace=pulse-core-nextjs&cloudshell_tutorial=GOOGLE_CLOUD_DEPLOYMENT.md"
    
    print(f"Generating QR Code for deployment URL:")
    print(deploy_url)
    print()
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    
    qr.add_data(deploy_url)
    qr.make(fit=True)
    
    # Create PNG image
    img = qr.make_image(image_factory=PyPNGImage, fill_color="black", back_color="white")
    img.save(output_file)
    
    # Generate SVG version
    factory = qrcode.image.svg.SvgPathImage
    svg_img = qrcode.make(deploy_url, image_factory=factory)
    svg_img.save("deploy-qrcode.svg")
    
    # Print ASCII QR to terminal
    qr.print_ascii(invert=True)
    
    print()
    print(f"✅ QR Code generated successfully!")
    print(f"📁 PNG File: {output_file}")
    print(f"📁 SVG File: deploy-qrcode.svg")
    print()
    print("Scan this QR code with any mobile device to start deployment directly to Google Cloud.")

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            generate_qr(sys.argv[1])
        else:
            generate_qr()
    except ImportError:
        print("Installing required packages...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "qrcode[pil]"])
        print("Packages installed. Run again to generate QR code.")