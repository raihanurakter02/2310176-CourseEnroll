"""
convert_report_to_docx.py
Converts docs/FINAL_REPORT.md into a beautifully formatted Word document (.docx).
Applies high-end academic styling conforming to IUB CSE309 guidelines.
"""

import re
import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, hex_color):
    """Set the background color of a table cell."""
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    """Set padding/margins for a table cell in dxa (1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table, color="CBD5E1", sz="4", val="single"):
    """Apply clean, subtle borders to a table."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="none"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="none"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def setup_page_layout(doc):
    """Configure page dimensions, margins, header, and footer."""
    section = doc.sections[0]
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)
    section.page_width = Inches(8.5)
    section.page_height = Inches(11.0)
    
    # Running Header
    header = section.header
    p_hdr = header.paragraphs[0]
    p_hdr.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_hdr = p_hdr.add_run("CSE309 Final Project Submission Report — CourseEnroll (ID: 2310176)")
    r_hdr.font.name = "Arial"
    r_hdr.font.size = Pt(8.5)
    r_hdr.font.color.rgb = RGBColor(148, 163, 184)
    
    # Running Footer
    footer = section.footer
    p_ftr = footer.paragraphs[0]
    p_ftr.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r_ftr = p_ftr.add_run("Independent University, Bangladesh (IUB) | Department of CSE | Autumn 2026")
    r_ftr.font.name = "Arial"
    r_ftr.font.size = Pt(8.5)
    r_ftr.font.color.rgb = RGBColor(148, 163, 184)

def parse_inline_formatting(paragraph, text, base_font="Arial", base_size=Pt(10.0), base_color=RGBColor(30, 41, 59), bold=False, italic=False):
    """Parse bold, italic, inline code, and links in markdown text and add runs to paragraph."""
    pattern = re.compile(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))')
    tokens = pattern.split(text)
    
    for token in tokens:
        if not token:
            continue
        if token.startswith('**') and token.endswith('**'):
            inner = token[2:-2]
            run = paragraph.add_run(inner)
            run.font.name = base_font
            run.font.size = base_size
            run.font.bold = True
            run.font.italic = italic
            run.font.color.rgb = base_color
        elif token.startswith('*') and token.endswith('*') and not token.startswith('**'):
            inner = token[1:-1]
            run = paragraph.add_run(inner)
            run.font.name = base_font
            run.font.size = base_size
            run.font.bold = bold
            run.font.italic = True
            run.font.color.rgb = base_color
        elif token.startswith('`') and token.endswith('`'):
            inner = token[1:-1]
            run = paragraph.add_run(inner)
            run.font.name = "Consolas"
            run.font.size = Pt(base_size.pt * 0.9)
            run.font.bold = bold
            run.font.italic = italic
            run.font.color.rgb = RGBColor(15, 23, 42)
        elif token.startswith('[') and '](' in token and token.endswith(')'):
            m = re.match(r'\[([^\]]+)\]\(([^)]+)\)', token)
            if m:
                label, url = m.groups()
                run = paragraph.add_run(label)
                run.font.name = base_font
                run.font.size = base_size
                run.font.bold = bold
                run.font.italic = italic
                run.font.underline = True
                run.font.color.rgb = RGBColor(37, 99, 235)
            else:
                run = paragraph.add_run(token)
                run.font.name = base_font
                run.font.size = base_size
                run.font.bold = bold
                run.font.italic = italic
                run.font.color.rgb = base_color
        else:
            run = paragraph.add_run(token)
            run.font.name = base_font
            run.font.size = base_size
            run.font.bold = bold
            run.font.italic = italic
            run.font.color.rgb = base_color

def add_styled_table(doc, table_data):
    """Render a markdown table with navy header, white text, zebra rows, and clean borders."""
    if not table_data or len(table_data) < 2:
        return
        
    headers = table_data[0]
    data_rows = table_data[1:]
    num_cols = len(headers)
    
    table = doc.add_table(rows=len(data_rows) + 1, cols=num_cols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table, color="CBD5E1")
    
    # Calculate column proportions based on max character lengths
    col_max_lens = [len(h) for h in headers]
    for row in data_rows:
        for c_idx in range(num_cols):
            if c_idx < len(row):
                col_max_lens[c_idx] = max(col_max_lens[c_idx], len(row[c_idx]))
                
    total_len = max(1, sum(col_max_lens))
    total_width = 6.5  # inches
    col_widths = [Inches(max(0.8, (l / total_len) * total_width)) for l in col_max_lens]
    
    # Normalize widths to total 6.5 inches
    curr_sum = sum(w.inches for w in col_widths)
    scale = total_width / curr_sum
    col_widths = [Inches(w.inches * scale) for w in col_widths]
    
    # Header Row
    hdr_row = table.rows[0]
    hdr_row._tr.get_or_add_trPr().append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
    
    for i, title in enumerate(headers):
        cell = hdr_row.cells[i]
        cell.width = col_widths[i]
        set_cell_background(cell, "1E3A8A")  # Navy Blue
        set_cell_margins(cell, top=120, bottom=120, left=120, right=120)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(title.strip())
        run.bold = True
        run.font.name = "Arial"
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(255, 255, 255)
        
    # Data Rows
    for r_idx, row_data in enumerate(data_rows):
        row = table.rows[r_idx + 1]
        bg_color = "F8FAFC" if (r_idx % 2 == 1) else "FFFFFF"
        for c_idx in range(num_cols):
            val = row_data[c_idx] if c_idx < len(row_data) else ""
            cell = row.cells[c_idx]
            cell.width = col_widths[c_idx]
            if bg_color != "FFFFFF":
                set_cell_background(cell, bg_color)
            set_cell_margins(cell, top=90, bottom=90, left=120, right=120)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            parse_inline_formatting(p, val.strip(), base_font="Arial", base_size=Pt(8.0), base_color=RGBColor(30, 41, 59))
            
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(6)

def add_code_block(doc, code_str, lang=""):
    """Render a code or diagram block with dark slate background and Consolas font."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.rows[0].cells[0]
    cell.width = Inches(6.5)
    
    # Dark slate background
    set_cell_background(cell, "0F172A")
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
    
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="334155"/>'
        f'<w:left w:val="single" w:sz="6" w:space="0" w:color="334155"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="334155"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="334155"/>'
        f'</w:tcBorders>'
    )
    cell._tc.get_or_add_tcPr().append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(code_str.strip())
    run.font.name = "Consolas"
    run.font.size = Pt(8.0)
    run.font.color.rgb = RGBColor(241, 245, 249)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(6)

def add_callout(doc, text):
    """Render a blockquote callout box."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.rows[0].cells[0]
    cell.width = Inches(6.5)
    set_cell_background(cell, "F1F5F9")  # Slate-100
    set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
    
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="1E3A8A"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    cell._tc.get_or_add_tcPr().append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    parse_inline_formatting(p, text.strip(), base_font="Arial", base_size=Pt(9.0), base_color=RGBColor(51, 65, 85), italic=True)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(6)

def generate_docx_from_markdown(md_path, docx_path):
    """Main parser: converts markdown file to high-quality styled DOCX."""
    with open(md_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    doc = docx.Document()
    setup_page_layout(doc)
    
    in_code_block = False
    code_lang = ""
    code_lines = []
    
    in_table = False
    table_rows = []
    
    i = 0
    total_lines = len(lines)
    
    while i < total_lines:
        line = lines[i].rstrip("\r\n")
        stripped = line.strip()
        
        # Handle code blocks
        if stripped.startswith("```"):
            if not in_code_block:
                in_code_block = True
                code_lang = stripped[3:].strip()
                code_lines = []
            else:
                in_code_block = False
                add_code_block(doc, "\n".join(code_lines), code_lang)
                code_lines = []
            i += 1
            continue
            
        if in_code_block:
            code_lines.append(line)
            i += 1
            continue
            
        # Handle tables
        if stripped.startswith("|") and "|" in stripped[1:]:
            # Check if it is a separator row with ESCAPED dash!
            if re.match(r'^\|[\s:\-|]+\|$', stripped):
                i += 1
                continue
            cols = [c.strip() for c in stripped.strip("|").split("|")]
            table_rows.append(cols)
            in_table = True
            i += 1
            continue
        else:
            if in_table:
                add_styled_table(doc, table_rows)
                table_rows = []
                in_table = False
                
        # Empty line
        if not stripped:
            i += 1
            continue
            
        # Horizontal rules
        if stripped in ("---", "***", "___"):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(8)
            borders = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CBD5E1"/></w:pBdr>')
            p._p.get_or_add_pPr().append(borders)
            i += 1
            continue
            
        # Headings
        if stripped.startswith("#"):
            # Check major parts to insert page break before
            major_sections = [
                "# 1. Executive Summary",
                "# Part A.",
                "# Part B.",
                "# Part C.",
                "# Part D.",
                "# Part E.",
                "# Appendix"
            ]
            for ms in major_sections:
                if stripped.startswith(ms):
                    doc.add_page_break()
                    break
                    
            if stripped.startswith("####"):
                heading_text = stripped[4:].strip()
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(8)
                p.paragraph_format.space_after = Pt(2)
                p.paragraph_format.keep_with_next = True
                parse_inline_formatting(p, heading_text, base_font="Arial", base_size=Pt(9.5), base_color=RGBColor(71, 85, 105), bold=True)
            elif stripped.startswith("###"):
                heading_text = stripped[3:].strip()
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(10)
                p.paragraph_format.space_after = Pt(3)
                p.paragraph_format.keep_with_next = True
                parse_inline_formatting(p, heading_text, base_font="Arial", base_size=Pt(11.0), base_color=RGBColor(30, 58, 138), bold=True)
            elif stripped.startswith("##"):
                heading_text = stripped[2:].strip()
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(13)
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.keep_with_next = True
                parse_inline_formatting(p, heading_text, base_font="Arial", base_size=Pt(13.0), base_color=RGBColor(15, 23, 42), bold=True)
            elif stripped.startswith("#"):
                heading_text = stripped[1:].strip()
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(16)
                p.paragraph_format.space_after = Pt(6)
                p.paragraph_format.keep_with_next = True
                parse_inline_formatting(p, heading_text, base_font="Arial", base_size=Pt(15.0), base_color=RGBColor(30, 58, 138), bold=True)
            i += 1
            continue
            
        # Blockquote
        if stripped.startswith(">"):
            quote_text = stripped.lstrip("> ").strip()
            add_callout(doc, quote_text)
            i += 1
            continue
            
        # Bullet list items
        if stripped.startswith(("* ", "- ")):
            item_text = stripped[2:].strip()
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            parse_inline_formatting(p, item_text, base_font="Arial", base_size=Pt(9.5), base_color=RGBColor(30, 41, 59))
            i += 1
            continue
            
        # Numbered list items
        num_match = re.match(r'^(\d+)\.\s+(.*)$', stripped)
        if num_match:
            num_val, item_text = num_match.groups()
            p = doc.add_paragraph(style='List Number')
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            parse_inline_formatting(p, item_text, base_font="Arial", base_size=Pt(9.5), base_color=RGBColor(30, 41, 59))
            i += 1
            continue
            
        # Regular paragraph
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        parse_inline_formatting(p, stripped, base_font="Arial", base_size=Pt(9.5), base_color=RGBColor(30, 41, 59))
        i += 1
        
    # Flush any remaining table
    if in_table and table_rows:
        add_styled_table(doc, table_rows)
        
    # Save output docx
    os.makedirs(os.path.dirname(os.path.abspath(docx_path)), exist_ok=True)
    doc.save(docx_path)
    print(f"Successfully generated DOCX at: {docx_path}")

if __name__ == "__main__":
    md_file = "docs/FINAL_REPORT.md"
    docx_file = "docs/Final_Project_Submission_Report_2310176.docx"
    generate_docx_from_markdown(md_file, docx_file)
