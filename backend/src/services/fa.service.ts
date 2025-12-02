import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";
import puppeteer from "puppeteer";

// Registrar helpers de Handlebars
Handlebars.registerHelper('add', function(a: number, b: number) {
  return a + b;
});

Handlebars.registerHelper('multiply', function(a: number, b: number) {
  return a * b;
});

Handlebars.registerHelper('subtract', function(a: number, b: number) {
  return a - b;
});

type Aspecto = { descripcion: string; puntaje: number };
type Encabezado = {
  convocatoria: string; unidadAdministrativa: string; concurso: string;
  puesto?: string; codigoPuesto: string; folio?: string; modalidad: string; duracionMin: number | string;
  nombreEspecialista: string; puestoEspecialista?: string;
};
type Caso = { planteamiento?: string; temasGuia?: string; equipo?: string; };
type FAArgs = { 
  encabezado: Encabezado; 
  caso: Caso; 
  criterios: Aspecto[];
  casoNumero?: number;
  totalCasos?: number;
  casos?: any[];
};

export async function generarFA(args: FAArgs): Promise<Buffer> {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Generando FA con args:', JSON.stringify(args, null, 2));
    }
    
    // Usar plantilla multi-caso si hay múltiples casos
    const templateName = args.casos && args.casos.length > 0 ? "fa-multi.hbs" : "fa.hbs";
    const tplPath = path.resolve(__dirname, `../templates/${templateName}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log('Template path:', tplPath);
    }
    
    if (!fs.existsSync(tplPath)) {
      throw new Error(`Template no encontrado en: ${tplPath}`);
    }
    
    const tplSrc = fs.readFileSync(tplPath, "utf8");
    const tpl = Handlebars.compile(tplSrc);

    // Usar el nuevo logo PNG de INEGI
    const logoPath = path.resolve(__dirname, "../assets/Logo.png");
    if (process.env.NODE_ENV !== 'production') {
      console.log('Logo PNG path:', logoPath);
    }
    
    if (!fs.existsSync(logoPath)) {
      throw new Error(`Logo PNG no encontrado en: ${logoPath}`);
    }
    
    // Convertir la imagen PNG a base64 para embeber en el HTML
    const logoBuffer = fs.readFileSync(logoPath);
    const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

    const html = tpl({ ...args, logoBase64 });
    if (process.env.NODE_ENV !== 'production') {
      console.log('HTML generado (primeros 500 chars):', html.substring(0, 500));
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--font-render-hinting=medium"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfUnit8 = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "22mm", right: "18mm", bottom: "22mm", left: "18mm" },
    });
    await browser.close();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('PDF generado exitosamente, tamaño:', pdfUnit8.length, 'bytes');
    }
    return Buffer.from(pdfUnit8);
  } catch (error) {
    console.error('Error en generarFA:', error);
    throw error;
  }
}
