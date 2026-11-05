---
name: sahay-project-details
description: SAHAY Gov Scheme RAG Chatbot implementation notes for internship report
metadata:
  type: reference
---

## SAHAY — Government Scheme RAG Chatbot (Project 2)

**GitHub:** https://code.swecha.org/aumnamaha/gov_scheme_rag_chatbot

### Core Features Implemented:
1. **Multi-language UI:** English | हिंदी (Hindi) | తెలుగు (Telugu)
2. **Profile Filters:** Category, State, Income (₹), Age Group
3. **RAG Chat Assistant:** Gemini API with knowledge base retrieval
4. **PDF Uploader:** Income certificate analysis with pypdf
5. **Available Schemes Tab:** Static database cards (Ayushman, PM-KISAN, Rythu Bharosa)
6. **How to Apply Tab:** Step-by-step instructions + document checklist

### Tech Stack:
- Streamlit (framework)
- Python 3.10+
- Gemini API (RAG inference)
- pypdf (PDF parsing)
- Static JSON knowledge base

### Key Code Sections:
- Lines 39-121: Multi-language dictionary (`LANG_DICT`)
- Lines 126-180: Knowledge base schemes (`SCHEMES_DB`)
- Lines 185-216: RAG inference function with PDF injection
- Lines 277-294: PDF extraction block

### Screenshots:
- `/home/aumnamaha/Pictures/Gov Scheme Pictures/` (4 screenshots available)
