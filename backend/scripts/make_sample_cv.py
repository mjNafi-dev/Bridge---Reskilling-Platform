"""
Makes the SYNTHETIC sample CV (frontend/public/cv/sample-cv-graphic-designer.pdf) that the
"use the sample CV" link uploads. Not a real person. Dev-only: pip install fpdf2
Run from the repo root:   python backend/scripts/make_sample_cv.py
"""

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "cv" / "sample-cv-graphic-designer.pdf"

CV = [
    ("name", "Aina Rahman"),
    ("small", "Sample CV for the Bridge demo - not a real person  |  Kuala Lumpur, Malaysia  |  aina.sample@example.com"),
    ("h", "PROFILE"),
    ("p", "Graphic designer with five years of social media and print work, looking to move into video and motion design."),
    ("h", "WORK EXPERIENCE"),
    ("b", "Graphic Designer | Studio Kopi Creative Sdn Bhd"),
    ("small", "Jan 2021 - Present"),
    ("li", "Designed social media posters and campaign visuals for retail clients"),
    ("li", "Retouched product photos for e-commerce listings"),
    ("li", "Built brand colour palettes and simple style guides"),
    ("li", "Prepared print-ready layouts for brochures and banners"),
    ("li", "Edited short promo videos for Instagram Reels in Premiere Pro"),
    ("p", "Tools: Photoshop, Illustrator, Lightroom, Canva"),
    ("b", "Junior Designer | PrintHub Enterprise"),
    ("small", "Jun 2019 - Dec 2020"),
    ("li", "Laid out flyers and restaurant menus in InDesign"),
    ("li", "Checked colour proofs before printing"),
    ("h", "EDUCATION"),
    ("b", "Diploma in Graphic Design"),
    ("small", "Kolej Seni Kreatif, Kuala Lumpur  |  2016 - 2019"),
    ("h", "SKILLS"),
    ("p", "Photo retouching (Advanced), Colour correction, Layout & composition, Typography, Basic photography"),
    ("p", "Software: Photoshop, Illustrator, InDesign, Lightroom, Premiere Pro, Canva"),
    ("h", "LANGUAGES"),
    ("p", "English (Fluent), Bahasa Melayu (Native)"),
    ("h", "CERTIFICATIONS"),
    ("p", "Adobe Lightroom Essentials - LinkedIn Learning, 2021"),
    ("h", "PROJECTS & VOLUNTEERING"),
    ("b", "Photography club Instagram, 2017 - 2019"),
    ("li", "Planned weekly posts and edited event photos"),
    ("h", "INTERESTS"),
    ("p", "Photography walks, Football, Mystery novels"),
]


def main():
    pdf = FPDF(format="A4")
    pdf.set_margins(18, 16, 18)
    pdf.add_page()
    for kind, text in CV:
        if kind == "name":
            pdf.set_font("Helvetica", "B", 20)
            pdf.cell(0, 10, text, new_x="LMARGIN", new_y="NEXT")
        elif kind == "h":
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_text_color(40, 40, 40)
            pdf.cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
            pdf.set_draw_color(200, 200, 200)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.ln(1.5)
        elif kind == "b":
            pdf.set_font("Helvetica", "B", 10.5)
            pdf.set_text_color(0, 0, 0)
            pdf.cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")
        elif kind == "small":
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(110, 110, 110)
            pdf.cell(0, 5, text, new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(0, 0, 0)
        elif kind == "li":
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(0, 5.2, "- " + text, new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(0, 5.2, text, new_x="LMARGIN", new_y="NEXT")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
