import re

with open("src/App.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Remove states
text = text.replace('  const [isCreadorCuadroSinopticoOpen, setIsCreadorCuadroSinopticoOpen] = useState<boolean>(false);\n', '')
text = text.replace('  const [isCreadorSinopsisFracturasOpen, setIsCreadorSinopsisFracturasOpen] = useState<boolean>(false);\n', '')

# 2. Remove Card 8: Cuadro Sinóptico Órgano (IA) and Card 8b: Sinopsis de Fracturas (IA)
cards_pattern = r'\{\/\* Card 8: Cuadro Sinóptico Órgano \(IA\) \*\/\}[\s\S]*?\{\/\* Card 9: Resumen Operacional para WhatsApp \(IA\) \*\/\}\s*'
replacement = '{/* Card 9: Resumen Operacional para WhatsApp (IA) */}\n'
text = re.sub(cards_pattern, replacement, text)

# 3. Remove Render Creador de Cuadro Sinóptico Panel & Sinopsis de Fracturas Panel
panels_pattern = r'\{\/\* Render Creador de Cuadro Sinóptico Panel \*\/\}[\s\S]*?(?=\{\/\* Render Radar Biomecánico Panel \*\/\}|\{\/\* Render Asistente de Medidas Panel \*\/\}|isBiomechanicalRadarOpen)'
text = re.sub(panels_pattern, '', text)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Synoptic cards and panels removed from App.tsx!")
