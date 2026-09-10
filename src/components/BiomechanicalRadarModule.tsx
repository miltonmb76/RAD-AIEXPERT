import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  Flame,
  ShieldAlert,
  Loader2,
  Check,
  Copy,
  FileText,
  Sliders,
  RotateCcw,
  Sparkles,
  Info,
  ChevronRight,
  TrendingUp,
  Zap,
  Target,
  Trash2
} from "lucide-react";

export interface BiomechanicalAxis {
  key: string;
  label: string;
  score: number; // 0 to 10
  level: string; // e.g. "Fisiológico", "Leve", "Moderado", "Severo", "Crítico"
  finding: string;
  justification: string;
}

export interface BiomechanicalRadarData {
  globalLoadIndex: string; // "Baja", "Moderada", "Elevada", "Crítica"
  globalScore: number;
  dominantVector: string;
  radarMode?: string; // "msk" | "visceral" | "oncology" | "rotator_cuff" | "knee_oa" | "cholecystitis" | "ankle_trauma" | "hepatic" | "renal" | "scrotal" | "urinary_prostate" | "diverticulitis" | "appendicitis" | "thyroid" | "knee_trauma" | "muscle_injury"
  axes: BiomechanicalAxis[];
  clinicalSummary: string;
  recommendation: string;
}

interface BiomechanicalRadarModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  onReportUpdated: (newText: string) => void;
  onRadarDataUpdated?: (data: BiomechanicalRadarData | null) => void;
  includeRadarInReport?: boolean;
  onToggleIncludeRadar?: (include: boolean) => void;
}

const PRESET_MATRICES_AXES: Record<string, BiomechanicalAxis[]> = {
  diverticulitis: [
    { key: "engrosamiento_parietal", label: "Engrosamiento Parietal Cólico", score: 0, level: "Fisiológico", finding: "Espesor de la pared cólica normal (<=2.0-2.5 mm) con estratificación conservada.", justification: "Sin engrosamiento ni rigidez parietal segmentaria." },
    { key: "grasa_pericolica", label: "Grasa Pericólica / Flemón", score: 0, level: "Fisiológico", finding: "Grasa pericólica homogénea, compresible y de ecogenicidad habitual.", justification: "Sin halo hiperecogénico, flemón ni edema pericólico." },
    { key: "diverticulo_inflamado", label: "Divertículo Inflamado / Fecalito", score: 0, level: "Fisiológico", finding: "Sin divertículos inflamados evidentes ni fecalitos obstructivos con halo hipoecoico.", justification: "Ausencia de diverticulitis focal con dolor selectivo bajo transductor." },
    { key: "hiperemia_vascular", label: "Hiperemia Vascular (Doppler)", score: 0, level: "Fisiológico", finding: "Vascularización parietal y mesentérica en límites fisiológicos.", justification: "Sin hiperemia Doppler patológica ni áreas de isquemia." },
    { key: "complicacion_absceso", label: "Complicación Locorregional (Absceso)", score: 0, level: "Fisiológico", finding: "Sin colecciones líquidas tabicadas ni abscesos pericólicos/pélvicos (Hinchey 0/Ia).", justification: "Ausencia de colecciones purulentas o flemosas." },
    { key: "gas_extraluminal", label: "Gas Extraluminal / Perforación", score: 0, level: "Fisiológico", finding: "Gas intraluminal confinado a la luz cólica sin burbujas extraluminales ni neumoperitoneo.", justification: "Sin microperforación ni neumoperitoneo libre (Hinchey IV)." }
  ],
  urinary_prostate: [
    { key: "volumen_prostatico", label: "Volumen Prostático", score: 0, level: "Fisiológico", finding: "Volumen prostático conservado (<20-25 cc) sin hiperplasia.", justification: "Morfología y biometría glandular dentro de límites fisiológicos." },
    { key: "paredes_vesicales", label: "Paredes Vesicales", score: 0, level: "Fisiológico", finding: "Pared vesical lisa y delgada (<3 mm en repleción, <5 mm vacía).", justification: "Sin engrosamiento parietal, trabeculaciones ni cistopatía de lucha." },
    { key: "ectasia_renal", label: "Ectasia Renal", score: 0, level: "Fisiológico", finding: "Seno renal ecolucente sin ectasia pielocalicial ni uropatía obstructiva.", justification: "Pelvis y cálices de calibre normal sin signos de reflujo/estasis." },
    { key: "residuo_postmiccional", label: "Residuo Postmiccional (RPM)", score: 0, level: "Fisiológico", finding: "Vaciado vesical adecuado con RPM fisiológico/despreciable (<10-15% o <30 cc).", justification: "Sin retención urinaria postmiccional significativa." },
    { key: "parenquima_prostatico", label: "Parénquima Prostático", score: 0, level: "Fisiológico", finding: "Ecoestructura homogénea sin nódulos sospechosos periféricos ni adenomas prominentes.", justification: "Diferenciación zonal preservada y ausencia de LOEs sospechosas." },
    { key: "bordes_prostaticos", label: "Bordes Prostáticos", score: 0, level: "Fisiológico", finding: "Cápsula prostática continua, regular y nítida sin impronta vesical significativa.", justification: "Límites anatómicos bien definidos sin crecimiento endovesical patológico." }
  ],
  rotator_cuff: [
    { key: "ruptura_supraespinoso", label: "Ruptura del Supraespinoso", score: 0, level: "Fisiológico", finding: "Sin evidencia de desgarro ni solución de continuidad en el supraespinoso.", justification: "Integridad fibrilar conservada." },
    { key: "bursitis", label: "Bursitis Subacromiodeltoidea", score: 0, level: "Fisiológico", finding: "Bursa subacromial de espesor normal, sin líquido anormal.", justification: "Ausencia de distensión o reacción inflamatoria bursal." },
    { key: "pinzamiento", label: "Pinzamiento Subacromial", score: 0, level: "Fisiológico", finding: "Dinámica subacromial conservada sin conflicto de espacio.", justification: "Sin fricción ni atrapamiento en maniobras." },
    { key: "otros_tendones", label: "Lesión de Otros Tendones del Manguito", score: 0, level: "Fisiológico", finding: "Tendones infraespinoso, subescapular y redondo menor intactos.", justification: "Estructura y patrón fibrilar normal en tendones adyacentes." },
    { key: "tendinosis_supraespinoso", label: "Tendinosis del Supraespinoso", score: 0, level: "Fisiológico", finding: "Ecoestructura y espesor fibrilar habituales.", justification: "Sin cambios tendinósicos crónicos ni calcificaciones." },
    { key: "tclb", label: "Tendón Cabeza Larga del Bíceps (TCLB)", score: 0, level: "Fisiológico", finding: "TCLB centrado en la corredera bicipital sin tenosinovitis.", justification: "Líquido peritendinoso fisiológico y retináculo intacto." }
  ],
  knee_oa: [
    { key: "femorotibial_medial", label: "Compartimento Femorotibial Medial", score: 0, level: "Fisiológico", finding: "Espacio articular medial de amplitud conservada.", justification: "Sin pinzamiento ni esclerosis subcondral." },
    { key: "femorotibial_lateral", label: "Compartimento Femorotibial Lateral", score: 0, level: "Fisiológico", finding: "Espacio articular lateral normal.", justification: "Sin disminución de espacio ni cambios osteoartrósicos." },
    { key: "meniscopatia_deg", label: "Meniscopatía Degenerativa", score: 0, level: "Fisiológico", finding: "Meniscos de morfología y ecogenicidad habituales.", justification: "Sin fisuras degenerativas ni extrusión meniscal." },
    { key: "cartilago_troclear", label: "Cartílago Troclear / Condromalacia", score: 0, level: "Fisiológico", finding: "Cartílago troclear de espesor uniforme y superficie lisa.", justification: "Sin condromalacia ni defectos condrales." },
    { key: "hidrartrosis", label: "Hidrartrosis / Efusión Articular", score: 0, level: "Fisiológico", finding: "Receso suprarrotuliano sin derrame significativo.", justification: "Líquido articular dentro de límites fisiológicos." },
    { key: "osteofitos", label: "Osteofitos Marginales & Entesofitos", score: 0, level: "Fisiológico", finding: "Márgenes óseos articulares regulares.", justification: "Sin osteofitosis marginal ni remodelado hipertrófico." }
  ],
  knee_trauma: [
    { key: "lcm", label: "Ligamento Colateral Medial (LCM)", score: 0, level: "Fisiológico", finding: "LCM de continuidad y espesor conservados.", justification: "Sin signos de esguince o brecha fibrilar." },
    { key: "lcl", label: "Ligamento Colateral Lateral / CPL", score: 0, level: "Fisiológico", finding: "LCL y complejo posterolateral continuos.", justification: "Sin edema o desgarro periligamentario." },
    { key: "menisco_interno", label: "Menisco Interno / Medial", score: 0, level: "Fisiológico", finding: "Menisco interno bien configurado sin rupturas.", justification: "Triángulo meniscal ecogénico e íntegro." },
    { key: "menisco_externo", label: "Menisco Externo / Lateral", score: 0, level: "Fisiológico", finding: "Menisco externo sin líneas de desgarro.", justification: "Puntal meniscal estable y en su sitio." },
    { key: "hidrartrosis", label: "Hidrartrosis / Hemartrosis", score: 0, level: "Fisiológico", finding: "Sin efusión o hemartrosis traumática.", justification: "Recesos articulares limpios." },
    { key: "lig_patelar", label: "Ligamento Patelar / Mecanismo Extensor", score: 0, level: "Fisiológico", finding: "Ligamento patelar de espesor y patrón fibrilar normal.", justification: "Mecanismo extensor sin desgarro ni entesopatía." }
  ],
  ankle_trauma: [
    { key: "lpaa", label: "Lig. Peroneo Astragalino Anterior (LPAA)", score: 0, level: "Fisiológico", finding: "LPAA continuo de espesor normal.", justification: "Sin brecha anecoica ni inestabilidad anterolateral." },
    { key: "lpc", label: "Lig. Peroneo Calcáneo (LPC)", score: 0, level: "Fisiológico", finding: "LPC preservado debajo de tendones peroneos.", justification: "Sin engrosamiento ni compromiso traumático." },
    { key: "deltoideo", label: "Complejo Ligamentoso Deltoideo", score: 0, level: "Fisiológico", finding: "Ligamento deltoideo medial de fibrilaridad conservada.", justification: "Espacio claro medial normal sin brechas." },
    { key: "hidrartrosis", label: "Hidrartrosis / Hemartrosis Articular", score: 0, level: "Fisiológico", finding: "Sin efusión articular en receso anterior.", justification: "Líquido intraarticular fisiológico." },
    { key: "tendones", label: "Tendones Peroneos / Mediales", score: 0, level: "Fisiológico", finding: "Tendones peroneos y tibiales en sus correderas.", justification: "Sin tenosinovitis ni subluxación retinacular." },
    { key: "oseo", label: "Estructuras Óseas / Sindesmosis", score: 0, level: "Fisiológico", finding: "Corticales óseas continuas y sindesmosis alineada.", justification: "Sin avulsiones óseas ni diástasis sindesmótica." }
  ],
  cholecystitis: [
    { key: "engrosamiento_pared", label: "Engrosamiento / Edema Parietal", score: 0, level: "Fisiológico", finding: "Pared vesicular fina <=3.0mm.", justification: "Sin edema parietal ni estratificación." },
    { key: "vascularidad", label: "Vascularidad Parietal (Doppler)", score: 0, level: "Fisiológico", finding: "Señal Doppler parietal normal.", justification: "Sin hiperemia inflamatoria de la pared." },
    { key: "necrosis_pared", label: "Necrosis Parietal / Gangrena", score: 0, level: "Fisiológico", finding: "Pared vesicular continua e intacta.", justification: "Sin gas intraparietal ni membranas desprendidas." },
    { key: "cambios_perivesiculares", label: "Cambios Perivesiculares / Lecho", score: 0, level: "Fisiológico", finding: "Grasa perivesicular limpia y libre.", justification: "Sin líquido ni colecciones perivesiculares." },
    { key: "via_biliar", label: "Vía Biliar / Colédoco", score: 0, level: "Fisiológico", finding: "Vía biliar intra y extrahepática de calibre normal.", justification: "Colédoco no dilatado sin coledocolitiasis." },
    { key: "tamano_forma", label: "Tamaño / Hidrops Vesicular", score: 0, level: "Fisiológico", finding: "Dimensiones vesiculares normales.", justification: "Sin hidrops ni sobredistensión vesicular." }
  ],
  appendicitis: [
    { key: "diametro_apendice", label: "Diámetro Apendicular", score: 0, level: "Fisiológico", finding: "Diámetro apendicular normal <=6.0mm.", justification: "Estructura tubular compresible de fondo ciego." },
    { key: "pared_apendice", label: "Pared / Signo de la Diana", score: 0, level: "Fisiológico", finding: "Pared fina <=2.0mm con capas conservadas.", justification: "Sin edema submucoso ni signo de la diana." },
    { key: "vascularidad", label: "Vascularidad Parietal (Doppler)", score: 0, level: "Fisiológico", finding: "Flujo vascular parietal simétrico y fino.", justification: "Sin hiperemia reactiva en anillo." },
    { key: "cambios_inflamatorios", label: "Grasa Periapendicular / Flemón", score: 0, level: "Fisiológico", finding: "Grasa mesoapendicular de ecogenicidad normal.", justification: "Sin cambios inflamatorios ni flemón." },
    { key: "liquido_colecciones", label: "Líquido Libre / Colecciones", score: 0, level: "Fisiológico", finding: "Fosa ilíaca derecha libre de líquido.", justification: "Sin colecciones ni abscesos periapendiculares." },
    { key: "apendicolito", label: "Apendicolito / Fecalito", score: 0, level: "Fisiológico", finding: "Luz apendicular limpia.", justification: "Sin apendicolitos ni obstrucción por fecalito." }
  ],
  thyroid: [
    { key: "tamano_tiroides", label: "Tamaño Glandular / Bocio", score: 0, level: "Fisiológico", finding: "Volumen tiroideo normal en ambos lóbulos.", justification: "Sin bocio ni efecto de masa intratorácica." },
    { key: "presencia_nodulos", label: "Carga Nodular", score: 0, level: "Fisiológico", finding: "Parénquima homogéneo libre de nódulos.", justification: "Sin imágenes nodulares sólidas ni quísticas." },
    { key: "nodulos_sospechosos", label: "Sospecha TI-RADS", score: 0, level: "Fisiológico", finding: "Sin nódulos con criterios de sospecha oncogénica.", justification: "Patrón ecográfico TI-RADS 1 / BENIGNO." },
    { key: "patron_parenquima", label: "Ecoestructura Parenquimatosa", score: 0, level: "Fisiológico", finding: "Ecoestructura glandular homogénea e isoecoica.", justification: "Sin signos de tiroiditis difusa ni septos fibrosos." },
    { key: "vascularidad", label: "Vascularidad / Inferno Tiroideo", score: 0, level: "Fisiológico", finding: "Patrón Doppler vascular fisiológico escaso.", justification: "Sin hiperemia difusa ni inferno tiroideo." },
    { key: "adenopatias_atipicas", label: "Adenopatías Cervicales Atípicas", score: 0, level: "Fisiológico", finding: "Cadenas ganglionares cervicales con morfología ovalada normal.", justification: "Ganglios con hilio graso conservado sin rasgos atípicos." }
  ],
  muscle_injury: [
    { key: "desgarro_muscular", label: "Desgarro Muscular / Solución Continuidad", score: 0, level: "Fisiológico", finding: "Arquitectura muscular y patrón en pluma de ave conservado.", justification: "Sin solución de continuidad ni brecha fibrilar." },
    { key: "hematoma_coleccion", label: "Hematoma / Colección Líquida", score: 0, level: "Fisiológico", finding: "Sin colecciones líquidas intra o interfasciales.", justification: "Ausencia de hematoma a tensión o seroma." },
    { key: "union_miotendinosa", label: "Unión Miotendinosa (MTJ)", score: 0, level: "Fisiológico", finding: "Unión miotendinosa continua e intacta.", justification: "Sin deslamado ni avulsión en la MTJ." },
    { key: "tendon_insercion", label: "Tendón e Inserción / Entesis", score: 0, level: "Fisiológico", finding: "Tendón de inserción de calibre y ecogenicidad normal.", justification: "Sin avulsión entésica ni desgarro intratendinoso." },
    { key: "vascularidad", label: "Vascularidad / Neovascularización", score: 0, level: "Fisiológico", finding: "Vascularización intramuscular baja normal.", justification: "Sin hiperemia perilesional ni neovasculatura." },
    { key: "cambios_inflamatorios", label: "Edema / Inflamación Intramuscular", score: 0, level: "Fisiológico", finding: "Vientres musculares limpios y simétricos.", justification: "Sin edema perifocal ni miositis reactiva." }
  ],
  hepatic: [
    { key: "tamano_forma", label: "Tamaño y Forma", score: 0, level: "Fisiológico", finding: "Hígado de dimensiones conservadas con borde inferior agudo y contornos lisos.", justification: "Sin hepatomegalia ni nodularidad capsular." },
    { key: "vascularidad", label: "Vascularidad", score: 0, level: "Fisiológico", finding: "Vena porta de calibre y flujo hepatópeto fásico normal, venas suprahepáticas trifásicas.", justification: "Sin hipertensión portal ni colaterales patológicas." },
    { key: "elasticidad", label: "Elasticidad", score: 0, level: "Fisiológico", finding: "Elasticidad en rango fisiológico normal (<6.0 kPa / F0-F1).", justification: "Sin rigidez parenquimatosa ni fibrosis significativa." },
    { key: "apariencia_parenquima", label: "Apariencia del Parénquima", score: 0, level: "Fisiológico", finding: "Ecoestructura parenquimatosa homogénea con patrón granular fino habitual.", justification: "Sin tosquedad ni patrón micronodular difuso." },
    { key: "infiltracion_grasa", label: "Infiltración Grasa", score: 0, level: "Fisiológico", finding: "Sin esteatosis hepática (Grado 0), gradiente hepatorrenal conservado y buena penetración acústica.", justification: "Atenuación acústica y ecogenicidad fisiológica." },
    { key: "lesiones_focales", label: "Lesiones Focales", score: 0, level: "Fisiológico", finding: "Parénquima homogéneo libre de lesiones ocupantes de espacio (LOEs).", justification: "Ausencia de nódulos sospechosos, quistes complicados ni masas sólidas." }
  ],
  renal: [
    { key: "tamano_renal", label: "Tamaño Renal", score: 0, level: "Fisiológico", finding: "Eje bipolar longitudinal conservado (100-120mm) con morfología reniforme simétrica.", justification: "Sin nefromegalia ni hipotrofia renal." },
    { key: "grosor_cortical", label: "Grosor Cortical", score: 0, level: "Fisiológico", finding: "Espesor cortical normal >=9-10mm con nítida diferenciación córtico-medular.", justification: "Sin adelgazamiento cortical ni hiperecogenicidad médica." },
    { key: "vascularidad", label: "Vascularidad", score: 0, level: "Fisiológico", finding: "Perfusión periférica completa con índices de resistividad intrarrenal fisiológicos (RI 0.58-0.70).", justification: "Sin defectos segmentarios ni signos de estenosis arterial." },
    { key: "lesiones_focales", label: "Lesiones Focales", score: 0, level: "Fisiológico", finding: "Parénquima homogéneo sin masas sólidas ni quistes complicados (Bosniak I o libre de LOEs).", justification: "Ausencia de LOEs sospechosas ni angiomiolipomas complejos." },
    { key: "procesos_obstructivos", label: "Procesos Obstructivos", score: 0, level: "Fisiológico", finding: "Seno renal ecolucente sin ectasia pielocalicial ni litiasis obstructiva.", justification: "Sin hidronefrosis ni uropatía obstructiva." },
    { key: "cambios_inflamatorios", label: "Cambios Inflamatorios", score: 0, level: "Fisiológico", finding: "Grasa perirrenal homogénea sin colecciones, gas ni áreas de nefronía.", justification: "Ausencia de estigmas de pielonefritis ni perinefritis." }
  ],
  scrotal: [
    { key: "tamano_testicular", label: "Tamaño Testicular", score: 0, level: "Fisiológico", finding: "Volumen y morfología testicular conservada dentro de rango fisiológico (8-25 cc).", justification: "Sin atrofia, hipotrofia ni orquimegalia anormal." },
    { key: "vascularidad_testicular", label: "Vascularidad Testicular", score: 0, level: "Fisiológico", finding: "Patrón de perfusión Doppler simétrico con índices de resistividad fisiológicos (RI 0.45-0.70).", justification: "Sin hiperemia inflamatoria ni defectos de perfusión / torsión." },
    { key: "integridad_epididimos", label: "Integridad de Epidídimos", score: 0, level: "Fisiológico", finding: "Epidídimos de grosor, contornos y ecoestructura homogénea habitual.", justification: "Sin signos de epididimitis aguda, espermatocele complicado ni flemón." },
    { key: "lesiones_focales", label: "Lesiones Focales", score: 0, level: "Fisiológico", finding: "Ecoestructura homogénea sin lesiones ocupantes de espacio ni microlitiasis densa.", justification: "Sin nódulos sólidos intratesticulares ni LOEs sospechosas." },
    { key: "varicocele", label: "Varicocele", score: 0, level: "Fisiológico", finding: "Plexo pampiniforme de calibre fisiológico (<2 mm) sin reflujo con maniobra de Valsalva.", justification: "Sin ectasia venosa ni reflujo patológico." },
    { key: "cambios_inflamatorios_hidrocele", label: "Cambios Inflamatorios e Hidrocele", score: 0, level: "Fisiológico", finding: "Líquido en túnica vaginal dentro de rango fisiológico sin engrosamiento parietal.", justification: "Sin hidrocele a tensión, piocele ni paquivaginalitis." }
  ],
  msk: [
    { key: "inflamacion", label: "Inflamación / Edema", score: 0, level: "Fisiológico", finding: "Sin efusión o edema significativo.", justification: "Ausencia de fluido anormal o reacción inflamatoria aguda." },
    { key: "estructural", label: "Compromiso Estructural", score: 0, level: "Fisiológico", finding: "Integridad tisular conservada.", justification: "Sin desgarros, rupturas ni soluciones de continuidad." },
    { key: "biomecanica", label: "Inestabilidad Biomecánica", score: 0, level: "Fisiológico", finding: "Estabilidad y mecánica tisular normal.", justification: "Sin sobrecarga, roce o inestabilidad pasiva." },
    { key: "vascularizacion", label: "Vascularización / Hiperemia", score: 0, level: "Fisiológico", finding: "Señal Doppler dentro de límites normales.", justification: "Sin neoangiogénesis ni hiperemia activa." },
    { key: "tension", label: "Tensión / Irritación", score: 0, level: "Fisiológico", finding: "Tensión miotendinosa y fascial adecuada.", justification: "Sin espasmo, contractura o tracción dolorosa." },
    { key: "cronicidad", label: "Cronicidad / Fibrosis", score: 0, level: "Fisiológico", finding: "Patrón fibrilar o tisular habitual.", justification: "Sin cambios tendinósicos crónicos ni calcificaciones." }
  ],
  visceral: [
    { key: "inflamacion", label: "Inflamación & Edema Parietal", score: 0, level: "Fisiológico", finding: "Paredes viscerales de espesor y estrías normales.", justification: "Sin edema edematoso ni engrosamiento parietal." },
    { key: "estructural", label: "Compromiso Tisular / Lisis", score: 0, level: "Fisiológico", finding: "Estratificación de pared conservada.", justification: "Sin lisis, necrosis ni solución de continuidad." },
    { key: "biomecanica", label: "Afectación Perivisceral", score: 0, level: "Fisiológico", finding: "Grasa perivisceral respetada e isoecoica.", justification: "Sin desestructuración del plano adjacente." },
    { key: "vascularizacion", label: "Vascularización / Hiperemia", score: 0, level: "Fisiológico", finding: "Flujo Doppler parietal fisiológico.", justification: "Sin hiperemia reactiva ni áreas de isquemia." },
    { key: "tension", label: "Irritación Serosa & Distensión", score: 0, level: "Fisiológico", finding: "Serosa sin irritación ni efusión perifocal.", justification: "Sin distensión tensional ni estasis." },
    { key: "cronicidad", label: "Cronicidad / Litiasis", score: 0, level: "Fisiológico", finding: "Sin litiasis ni secuelas cicatrizales.", justification: "Estructura limpia sin cambios recurrentes." }
  ],
  oncology: [
    { key: "estructural", label: "Arquitectura / Heterogeneidad", score: 0, level: "Fisiológico", finding: "Arquitectura tisular conservada y homogénea.", justification: "Sin masas heterogéneas ni bordes espiculados." },
    { key: "vascularizacion", label: "Neoangiogénesis & Neovasculatura", score: 0, level: "Fisiológico", finding: "Patrón vascular periférico y central ordenado.", justification: "Sin vasos caóticos de alta velocidad o neovasculatura." },
    { key: "biomecanica", label: "Invasión Tisular Local", score: 0, level: "Fisiológico", finding: "Planos de clivaje anatómicos preservados.", justification: "Sin infiltración de cápsula o grasa contigua." },
    { key: "tension", label: "Compromiso Vascular / Ductal", score: 0, level: "Fisiológico", finding: "Vasos principales y ductos permeables.", justification: "Sin encajonamiento ni trombosis tumoral." },
    { key: "inflamacion", label: "Necrosis Tumoral / Degeneración", score: 0, level: "Fisiológico", finding: "Tejido sólido uniforme sin degeneración quística.", justification: "Sin focos de necrosis ni lisis intratumoral." },
    { key: "cronicidad", label: "Adenopatías & Diseminación", score: 0, level: "Fisiológico", finding: "Ganglios regionales con morfología preservada.", justification: "Sin adenopatías atípicas ni implantes." }
  ]
};

const DEFAULT_AXES: BiomechanicalAxis[] = PRESET_MATRICES_AXES["msk"];

export const BiomechanicalRadarModule: React.FC<BiomechanicalRadarModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  onReportUpdated,
  onRadarDataUpdated,
  includeRadarInReport,
  onToggleIncludeRadar
}) => {
  const [data, setData] = useState<BiomechanicalRadarData | null>(null);
  const [axes, setAxes] = useState<BiomechanicalAxis[]>(DEFAULT_AXES);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [injected, setInjected] = useState<boolean>(false);
  const [selectedAxisKey, setSelectedAxisKey] = useState<string | null>(null);
  const [selectedRadarMode, setSelectedRadarMode] = useState<"auto" | "msk" | "visceral" | "oncology" | "rotator_cuff" | "knee_oa" | "cholecystitis" | "ankle_trauma" | "knee_trauma" | "appendicitis" | "thyroid" | "muscle_injury" | "hepatic" | "renal" | "scrotal" | "urinary_prostate" | "diverticulitis">("auto");

  const handleSelectMatrixMode = (mode: "auto" | "msk" | "visceral" | "oncology" | "rotator_cuff" | "knee_oa" | "cholecystitis" | "ankle_trauma" | "knee_trauma" | "appendicitis" | "thyroid" | "muscle_injury" | "hepatic" | "renal" | "scrotal" | "urinary_prostate" | "diverticulitis") => {
    setSelectedRadarMode(mode);
    // Only update axis skeleton for UI while analyzing. Do NOT push generic
    // preset "normal" findings into persisted radar/PDF data (that caused
    // intermittent wrong findings boxes when mode changed).
    if (mode !== "auto" && PRESET_MATRICES_AXES[mode]) {
      setAxes(PRESET_MATRICES_AXES[mode]);
    }
    if (reportText.trim()) {
      handleAnalyze(mode);
    }
  };

  const handleAnalyze = async (modeOverride?: "auto" | "msk" | "visceral" | "oncology" | "rotator_cuff" | "knee_oa" | "cholecystitis" | "ankle_trauma" | "knee_trauma" | "appendicitis" | "thyroid" | "muscle_injury" | "hepatic" | "renal" | "scrotal" | "urinary_prostate" | "diverticulitis") => {
    if (!reportText.trim()) {
      setError("El reporte clínico está vacío. Redacta o genera un informe primero.");
      return;
    }

    const modeToUse = modeOverride || selectedRadarMode;
    if (modeOverride) {
      setSelectedRadarMode(modeOverride);
      if (modeOverride !== "auto" && PRESET_MATRICES_AXES[modeOverride]) {
        setAxes(PRESET_MATRICES_AXES[modeOverride]);
      }
    }

    setIsLoading(true);
    setError(null);
    setInjected(false);

    try {
      const response = await fetch("/api/generate-biomechanical-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          radarMode: modeToUse
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        const incoming = resData.data;
        // Keep only axes with concrete findings/scores from the model response.
        if (Array.isArray(incoming.axes)) {
          incoming.axes = incoming.axes.map((axis: BiomechanicalAxis) => ({
            ...axis,
            finding: (axis.finding || "").trim(),
            justification: (axis.justification || "").trim(),
            score: typeof axis.score === "number" ? Math.min(10, Math.max(0, Math.round(axis.score))) : 0,
          }));
        }
        setData(incoming);
        if (incoming.radarMode) {
          setSelectedRadarMode(incoming.radarMode as any);
        }
        if (incoming.axes && Array.isArray(incoming.axes)) {
          setAxes(incoming.axes);
        }
        if (onRadarDataUpdated) {
          onRadarDataUpdated(incoming);
        }
      } else {
        setError(resData.error || "No se pudo calcular el Radar Biomecánico.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Error de comunicación con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScoreChange = (index: number, newScore: number) => {
    const updated = [...axes];
    let level = "Fisiológico";
    if (newScore >= 9) level = "Masivo / Crítico";
    else if (newScore >= 7) level = "Severo";
    else if (newScore >= 5) level = "Moderado";
    else if (newScore >= 2) level = "Leve";

    updated[index] = {
      ...updated[index],
      score: newScore,
      level
    };
    setAxes(updated);

    if (data) {
      const avg = +(updated.reduce((acc, a) => acc + a.score, 0) / updated.length).toFixed(1);
      let loadIdx = "Baja";
      if (avg >= 7.5) loadIdx = "Crítica";
      else if (avg >= 5.0) loadIdx = "Elevada";
      else if (avg >= 2.5) loadIdx = "Moderada";

      const updatedData = {
        ...data,
        globalScore: avg,
        globalLoadIndex: loadIdx,
        axes: updated
      };
      setData(updatedData);
      if (onRadarDataUpdated) {
        onRadarDataUpdated(updatedData);
      }
    }
  };

  const calculateGlobalAverage = () => {
    if (axes.length === 0) return 0;
    const sum = axes.reduce((acc, a) => acc + a.score, 0);
    return +(sum / axes.length).toFixed(1);
  };

  const globalAvg = data ? data.globalScore : calculateGlobalAverage();

  const getScoreColor = (score: number) => {
    if (score >= 8) return { text: "text-rose-400", bg: "bg-rose-500/20", border: "border-rose-500/40", stroke: "#f43f5e" };
    if (score >= 6) return { text: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/40", stroke: "#f59e0b" };
    if (score >= 3) return { text: "text-cyan-400", bg: "bg-cyan-500/20", border: "border-cyan-500/40", stroke: "#06b6d4" };
    return { text: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/40", stroke: "#10b981" };
  };

  const generateReportTextSection = () => {
    const avg = globalAvg;
    const dominant = data?.dominantVector || "Perfil Funcional Tisular";
    const summary = data?.clinicalSummary || "Evaluación sinérgica de los vectores de respuesta inflamatoria, daño tisular y respuesta hemodinámica Doppler.";

    let text = `--- RADAR BIOMECÁNICO E INFLAMATORIO ---\n\n`;
    text += `PUNTAJE GLOBAL DE CARGA TISULAR: ${avg} / 10.0 (Carga: ${(data?.globalLoadIndex || "Moderada").toUpperCase()})\n`;
    text += `VECTOR PATOLÓGICO DOMINANTE: ${dominant}\n\n`;
    text += `MATRIZ DE VECTORES CLAVE:\n`;

    axes.forEach(a => {
      text += `• ${a.label.toUpperCase()} [${a.score}/10 - ${a.level.toUpperCase()}]: ${a.finding} (${a.justification})\n`;
    });

    text += `\nSÍNTESIS BIOMECÁNICO-INFLAMATORIA:\n${summary}\n`;

    return text;
  };

  const handleInjectToReport = () => {
    const radarSection = generateReportTextSection();
    const radarPattern = /(?:\n\s*---\s*\n+)?(?:---\s*RADAR BIOMECÁNICO E INFLAMATORIO ---|###\s*ANEXO:\s*RADAR BIOMECÁNICO[^\n]*)[\s\S]*?(?=(?:\n\s*###|\n\s*---|(?:\n\s*\*\*)|$))/i;
    if (radarPattern.test(reportText)) {
      const newFull = reportText.replace(radarPattern, "\n\n" + radarSection);
      onReportUpdated(newFull.trim());
    } else {
      const newFull = reportText.trim() + "\n\n" + radarSection;
      onReportUpdated(newFull);
    }
    if (onToggleIncludeRadar) {
      onToggleIncludeRadar(true);
    }
    setInjected(true);
    setTimeout(() => setInjected(false), 4000);
  };

  const handleRemoveFromReport = () => {
    const radarPattern = /(?:\n\s*---\s*\n+)?(?:---\s*RADAR BIOMECÁNICO E INFLAMATORIO ---|###\s*ANEXO:\s*RADAR BIOMECÁNICO[^\n]*)[\s\S]*?(?=(?:\n\s*###|\n\s*---|(?:\n\s*\*\*)|$))/i;
    const clean = reportText.replace(radarPattern, "").trim();
    onReportUpdated(clean);
    if (onRadarDataUpdated) {
      onRadarDataUpdated(null);
    }
    if (onToggleIncludeRadar) {
      onToggleIncludeRadar(false);
    }
    setInjected(false);
  };

  const handleCopyText = () => {
    const radarSection = generateReportTextSection();
    navigator.clipboard.writeText(radarSection);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // SVG Radar calculations
  const svgSize = 320;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const maxRadius = 110;
  const numAxes = axes.length;

  const getCoordinates = (index: number, scoreValue: number) => {
    const angle = (Math.PI * 2 / numAxes) * index - Math.PI / 2;
    const r = (scoreValue / 10) * maxRadius;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y, angle };
  };

  // Generate polygon points for radar fill
  const radarPoints = axes
    .map((a, i) => {
      const { x, y } = getCoordinates(i, a.score);
      return `${x},${y}`;
    })
    .join(" ");

  const activeAxisObj = axes.find(a => a.key === selectedAxisKey) || axes[0];

  return (
    <div className="bg-slate-950/90 border-2 border-indigo-500/20 rounded-2xl p-4 md:p-6 shadow-2xl space-y-6 antialiased text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-600/30 to-rose-600/30 border border-indigo-500/40 rounded-xl shadow-inner">
            <Activity className="h-6 w-6 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-white font-mono">
                Radar Multivectorial Adaptativo 6D (IA)
              </h3>
              <span className="text-[9px] font-black uppercase font-mono tracking-widest bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-md">
                14 MATRICES
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Cuantificación multivectorial adaptada: MSK/Osteomuscular, Manguito Rotador, Artrosis Rodilla 6D, Trauma Rodilla 6D, Trauma Tobillo 6D, Colecistitis Aguda 6D, Apendicitis Aguda 6D, Valoración Tiroidea 6D, Lesiones Musculares 6D, Valoración Hepática 6D, Valoración Renal 6D, Valoración Escrotal / Testicular 6D, Visceral e Inflamatorio y Oncológico.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAnalyze()}
            disabled={isLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer font-mono"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Sparkles className="h-4 w-4 text-amber-300" />
            )}
            {isLoading ? "Calculando Radar..." : data ? "Recalcular Radar" : "Analizar Radar IA"}
          </button>
        </div>
      </div>

      {/* MANUAL MODALITY SELECTION RIBBON */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 flex flex-wrap items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 pl-1">
          <Sliders className="h-4 w-4 text-indigo-400" />
          <span>Matriz Vectorial:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectMatrixMode("auto")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "auto"
                ? "bg-indigo-600 text-white shadow-md border border-indigo-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
            title="La IA autodetecta la matriz óptima según los hallazgos del reporte"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Auto (IA)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("rotator_cuff")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "rotator_cuff"
                ? "bg-teal-600 text-white shadow-md border border-teal-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🩹 Manguito Rotador</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("knee_oa")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "knee_oa"
                ? "bg-emerald-600 text-white shadow-md border border-emerald-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🦵 Artrosis Rodilla</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("knee_trauma")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "knee_trauma"
                ? "bg-blue-600 text-white shadow-md border border-blue-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>💥 Trauma Rodilla 6D</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("ankle_trauma")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "ankle_trauma"
                ? "bg-cyan-600 text-white shadow-md border border-cyan-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🦶 Trauma de Tobillo</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("cholecystitis")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "cholecystitis"
                ? "bg-rose-600 text-white shadow-md border border-rose-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🫁 Colecistitis Aguda</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("appendicitis")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "appendicitis"
                ? "bg-red-600 text-white shadow-md border border-red-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🩺 Apendicitis Aguda</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("diverticulitis")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "diverticulitis"
                ? "bg-amber-700 text-white shadow-md border border-amber-500/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🎯 Diverticulitis Aguda 6D</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("thyroid")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "thyroid"
                ? "bg-purple-600 text-white shadow-md border border-purple-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🦋 Valoración Tiroidea</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("muscle_injury")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "muscle_injury"
                ? "bg-amber-600 text-white shadow-md border border-amber-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>💪 Lesiones Musculares</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("hepatic")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "hepatic"
                ? "bg-teal-600 text-white shadow-md border border-teal-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🔬 Hígado Integral 6D</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("renal")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "renal"
                ? "bg-cyan-600 text-white shadow-md border border-cyan-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🩺 Riñón Integral 6D</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("scrotal")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "scrotal"
                ? "bg-amber-600 text-white shadow-md border border-amber-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🥚 Escroto / Testicular 6D</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("urinary_prostate")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "urinary_prostate"
                ? "bg-blue-600 text-white shadow-md border border-blue-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>💧 Vías Urinarias y Próstata 6D</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("msk")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "msk"
                ? "bg-indigo-600 text-white shadow-md border border-indigo-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🦴 Articular / MSK</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("visceral")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "visceral"
                ? "bg-rose-600 text-white shadow-md border border-rose-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🫀 Visceral e Inflamatorio</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMatrixMode("oncology")}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRadarMode === "oncology"
                ? "bg-amber-600 text-white shadow-md border border-amber-400/50"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🔬 Oncológico / Tumoral</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: RADAR SPIDER CHART */}
        <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[360px]">
          {/* Badge indicator */}
          <div className="w-full flex items-center justify-between mb-2 px-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-ping"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
                Diagrama de Vectores Tisulares
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono font-bold">
              <span className="text-slate-400">Puntaje Global:</span>
              <span className={getScoreColor(globalAvg).text}>{globalAvg} / 10</span>
            </div>
          </div>

          {/* SVG RADAR GRAPH */}
          <div className="relative flex items-center justify-center my-2">
            <svg width={svgSize} height={svgSize} className="overflow-visible select-none">
              <defs>
                <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
                  <stop offset="70%" stopColor="#f43f5e" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="50%" stopColor="#f43f5e" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
              </defs>

              {/* Concentric Guide Hexagons */}
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, levelIdx) => {
                const hexPoints = axes
                  .map((_, i) => {
                    const { x, y } = getCoordinates(i, scale * 10);
                    return `${x},${y}`;
                  })
                  .join(" ");
                return (
                  <polygon
                    key={levelIdx}
                    points={hexPoints}
                    fill="none"
                    stroke="#334155"
                    strokeWidth={levelIdx === 4 ? "1.5" : "0.8"}
                    strokeDasharray={levelIdx < 4 ? "3,3" : "none"}
                    opacity={0.6}
                  />
                );
              })}

              {/* Radial Axis Lines */}
              {axes.map((_, i) => {
                const { x, y } = getCoordinates(i, 10);
                return (
                  <line
                    key={i}
                    x1={cx}
                    y1={cy}
                    x2={x}
                    y2={y}
                    stroke="#334155"
                    strokeWidth="1"
                    opacity={0.7}
                  />
                );
              })}

              {/* Data Filled Polygon */}
              <polygon
                points={radarPoints}
                fill="url(#radarGlow)"
                stroke="url(#radarStroke)"
                strokeWidth="2.5"
                className="transition-all duration-500 ease-out"
              />

              {/* Vertex Dots & Score Labels */}
              {axes.map((a, i) => {
                const { x, y, angle } = getCoordinates(i, a.score);
                const labelRadius = maxRadius + 22;
                const cosVal = Math.cos(angle);
                const sinVal = Math.sin(angle);
                
                let anchor = "middle";
                let lx = cx + labelRadius * cosVal;
                let ly = cy + labelRadius * sinVal;

                if (cosVal > 0.25) {
                  anchor = "start";
                  lx += 4;
                } else if (cosVal < -0.25) {
                  anchor = "end";
                  lx -= 4;
                }

                if (sinVal < -0.8) {
                  ly -= 4;
                } else if (sinVal > 0.8) {
                  ly += 6;
                }

                const isSelected = a.key === selectedAxisKey;
                const colors = getScoreColor(a.score);
                const cleanText = a.label.split(" / ")[0];

                return (
                  <g key={a.key} className="cursor-pointer" onClick={() => setSelectedAxisKey(a.key)}>
                    {/* Glowing outer circle on vertex */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 7 : 5}
                      fill={colors.stroke}
                      stroke="#0f172a"
                      strokeWidth="2"
                      className="transition-all duration-300"
                    />

                    {/* Outer Label */}
                    <text
                      x={lx}
                      y={ly}
                      textAnchor={anchor}
                      dominantBaseline="middle"
                      className={`text-[10px] font-mono font-bold tracking-tight transition-all fill-current ${
                        isSelected ? "fill-white font-black scale-105" : "fill-slate-300 hover:fill-white"
                      }`}
                    >
                      {cleanText}
                    </text>

                    {/* Badge Score over vertex */}
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      className="text-[9px] font-black font-mono fill-indigo-300"
                    >
                      {a.score}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Scale Legend */}
          <div className="flex items-center gap-3 text-[10px] font-mono font-semibold text-slate-400 mt-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800/80">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"></span>0-2: Fisiológico</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-500"></span>3-4: Leve</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"></span>5-6: Mod</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500"></span>7-10: Sev/Crítico</span>
          </div>
        </div>

        {/* RIGHT COLUMN: AXES SLIDERS & DETAILED BREAKDOWN */}
        <div className="lg:col-span-6 space-y-4">
          {/* Dominant Vector Card */}
          {data && (
            <div className="bg-gradient-to-r from-indigo-950/60 to-rose-950/40 border border-indigo-500/30 rounded-xl p-3.5 space-y-1.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase text-indigo-300 tracking-wider flex items-center gap-1">
                  <Target className="h-3.5 w-3.5 text-rose-400" /> Vector Dominante
                </span>
                <span className={`text-[9.5px] font-mono font-black uppercase px-2 py-0.5 rounded border ${
                  data.globalLoadIndex === "Crítica" ? "bg-rose-950/80 text-rose-300 border-rose-800" :
                  data.globalLoadIndex === "Elevada" ? "bg-amber-950/80 text-amber-300 border-amber-800" :
                  "bg-indigo-950/80 text-indigo-300 border-indigo-800"
                }`}>
                  Carga {data.globalLoadIndex}
                </span>
              </div>
              <p className="text-xs md:text-sm font-black text-white font-sans">
                {data.dominantVector}
              </p>
            </div>
          )}

          {/* Interactive Sliders for 6 Axes */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                Ajuste Manual de Vectores (0-10)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Modificable en tiempo real</span>
            </div>

            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {axes.map((a, idx) => {
                const colors = getScoreColor(a.score);
                const isSelected = a.key === selectedAxisKey;

                return (
                  <div
                    key={a.key}
                    onClick={() => setSelectedAxisKey(a.key)}
                    className={`p-2 rounded-xl transition-all border ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500/50 shadow-inner"
                        : "bg-slate-950/50 border-slate-800/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-200 font-sans text-[11px] flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${colors.bg} ${colors.border}`}></span>
                        {a.label}
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={`text-[10px] font-bold ${colors.text}`}>{a.level}</span>
                        <span className="text-xs font-black text-white bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded">
                          {a.score}/10
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={a.score}
                        onChange={(e) => handleScoreChange(idx, parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All Vectors Details Grid */}
          {data && data.axes && data.axes.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                <Info className="h-3.5 w-3.5 text-indigo-400" /> Detalle y Justificación de los Vectores
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {data.axes.map((axis, idx) => (
                  <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-start justify-between gap-1.5 border-b border-slate-800/80 pb-1">
                      <span className="text-[11px] font-bold text-slate-200 font-sans leading-tight min-w-0 flex-1">
                        {idx + 1}. {axis.label}
                      </span>
                      <span className={`text-[10px] font-mono font-bold shrink-0 whitespace-nowrap ${getScoreColor(axis.score).text}`}>
                        ({axis.level})
                      </span>
                    </div>
                    {axis.finding && (
                      <p className="text-[10.5px] text-slate-300 leading-snug">
                        <strong className="text-white">Hallazgo:</strong> {axis.finding}
                      </p>
                    )}
                    {axis.justification && axis.justification !== axis.finding && (
                      <p className="text-[10px] text-slate-400 italic leading-snug">
                        <strong className="text-slate-300 not-italic">Justificación:</strong> {axis.justification}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Summary Box (Without Recommendations) */}
      {data && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-1.5 w-full max-w-full box-border min-w-0 overflow-hidden">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-400" /> Síntesis Biomecánico-Inflamatoria Final
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed font-sans w-full max-w-full box-border break-words whitespace-normal overflow-wrap-anywhere m-0">
            {data.clinicalSummary}
          </p>
        </div>
      )}

      {/* Action Footer Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              handleInjectToReport();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer ${
              injected
                ? "bg-emerald-600 text-white border border-emerald-400"
                : "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white border border-indigo-400/40"
            }`}
          >
            {injected ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            {injected ? "Anexo Inyectado al Reporte" : "Inyectar Anexo al Reporte PDF"}
          </button>

          <button
            type="button"
            onClick={handleRemoveFromReport}
            className="flex items-center gap-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/80 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all shadow-md cursor-pointer"
            title="Quitar el anexo del radar del texto del reporte y desactivar su renderizado en PDF e impresión"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
            <span>Quitar Anexo</span>
          </button>

          <button
            onClick={handleCopyText}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado!" : "Copiar Matriz"}
          </button>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs font-mono font-bold text-slate-300 hover:text-white bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800">
          <input
            type="checkbox"
            checked={includeRadarInReport !== false}
            onChange={(e) => {
              const checked = e.target.checked;
              if (onToggleIncludeRadar) onToggleIncludeRadar(checked);
              if (!checked) {
                handleRemoveFromReport();
              } else {
                handleInjectToReport();
              }
            }}
            className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700 cursor-pointer"
          />
          <span>Incluir en PDF/Reporte</span>
        </label>
      </div>
    </div>
  );
};

export default BiomechanicalRadarModule;
