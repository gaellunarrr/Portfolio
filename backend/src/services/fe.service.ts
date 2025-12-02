import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";

type Encabezado = {
  convocatoria: string; 
  unidadAdministrativa: string; 
  concurso: string;
  puesto: string;
  codigoPuesto: string;
  folio: string;
  modalidad: string; 
  duracionMin: number | string;
  nombreEspecialista: string; 
  puestoEspecialista?: string;
};

type Aspecto = {
  descripcion: string;
  puntaje: number;
};

type Caso = {
  aspectos: Aspecto[];
  // Aquí podrían ir otros datos específicos del caso si los hay
};

type FEArgs = { 
  encabezado: Encabezado; 
  casos: Caso[]; // Array de casos, cada uno con sus aspectos
};

export async function generarFE(args: FEArgs): Promise<Buffer> {
  // Validar payload mínimo
  if (!args.encabezado || !args.casos || args.casos.length === 0) {
    throw new Error("Encabezado y casos son requeridos");
  }

  // Validar que cada caso tenga aspectos
  args.casos.forEach((caso, index) => {
    if (!caso.aspectos || caso.aspectos.length === 0) {
      throw new Error(`El caso ${index + 1} no tiene aspectos`);
    }
  });

  // Cargar la nueva plantilla FeConjunto.xlsx (todos los casos en una sola hoja)
  const templatePath = path.resolve(__dirname, "../assets/FeConjunto.xlsx");
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Plantilla no encontrada en: ${templatePath}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  
  // Obtener la hoja única de evaluación
  const ws = wb.getWorksheet(1); // Primera hoja del workbook
  if (!ws) {
    throw new Error("No se encontró la hoja de evaluación en la plantilla");
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Procesando ${args.casos.length} casos en una sola hoja`);
  }
  
  // FOLIO y Fecha
  const fechaActual = new Date().toLocaleDateString('es-MX');
  ws.getCell('L6').value = fechaActual;
  ws.getCell('N4').value = args.encabezado.folio; // Folio en celda N4
  
  // Encabezado (mismo para todos los casos)
  ws.getCell('C7').value = args.encabezado.convocatoria;
  ws.getCell('C8').value = args.encabezado.concurso;
  ws.getCell('C9').value = args.encabezado.puesto;
  ws.getCell('C10').value = args.encabezado.codigoPuesto;
  ws.getCell('C11').value = args.encabezado.unidadAdministrativa;
  
  // Procesar todos los casos en orden normal (1 → 2 → 3)
  // Usar un enfoque de ocultar filas en lugar de eliminarlas para mantener las posiciones
  
  for (let casoIndex = 0; casoIndex < args.casos.length; casoIndex++) {
    const casoData = args.casos[casoIndex];
    const numeroCaso = casoIndex + 1;
    
    // Definir las filas de aspectos y bloque para cada caso
    let filasAspectos: number[];
    let filaCalificacion: number;
    let filasBloque: number[] = [];
    switch (numeroCaso) {
      case 1:
        filasAspectos = [21, 23, 25, 27, 29, 31, 33, 35, 37, 39];
        filaCalificacion = 41;
        // Bloque: título (15), encabezado (16-20), aspectos (21-39), calificación (41), separación (42-44)
        filasBloque = [15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44];
        break;
      case 2:
        filasAspectos = [51, 53, 55, 57, 59, 61, 63, 65, 67, 69];
        filaCalificacion = 71;
        // Bloque: título (45), encabezado (46-50), aspectos (51-69), calificación (71), separación (72-74)
        filasBloque = [45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74];
        break;
      case 3:
        filasAspectos = [81, 83, 85, 87, 89, 91, 93, 95, 97, 99];
        filaCalificacion = 101;
        // Bloque: título (75), encabezado (76-80), aspectos (81-99), calificación (101), separación (102-104)
        filasBloque = [75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104];
        break;
      default:
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Caso ${numeroCaso} no soportado en la plantilla`);
        }
        continue;
    }
    const numeroAspectosActual = casoData.aspectos.length;
    const numeroAspectosMaximos = filasAspectos.length;
    // Si el caso 2 o 3 no tiene ningún aspecto, ocultar todo el bloque
    if ((numeroCaso === 2 || numeroCaso === 3) && numeroAspectosActual === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Ocultando todo el bloque del Caso ${numeroCaso} por no tener ámbitos.`);
      }
      for (const fila of filasBloque) {
        try {
          const row = ws.getRow(fila);
          row.eachCell((cell) => { cell.value = ''; });
          row.hidden = true;
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Error ocultando fila ${fila} del bloque del Caso ${numeroCaso}:`, error);
          }
        }
      }
      continue;
    }
    // Llenar los aspectos que tenemos
    casoData.aspectos.forEach((aspecto, aspectoIndex) => {
      const filaAspecto = filasAspectos[aspectoIndex];
      const numeroAspecto = aspectoIndex + 1;
      ws.getCell(`A${filaAspecto}`).value = numeroAspecto;
      ws.getCell(`A${filaAspecto}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`A${filaAspecto}`).font = { bold: true };
      ws.getCell(`C${filaAspecto}`).value = aspecto.descripcion;
      ws.getCell(`C${filaAspecto}`).alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };
      ws.getCell(`O${filaAspecto}`).value = aspecto.puntaje;
      ws.getCell(`O${filaAspecto}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`O${filaAspecto}`).numFmt = '0';
    });
    // Si tenemos menos aspectos que el máximo, ocultar las filas sobrantes
    if (numeroAspectosActual < numeroAspectosMaximos) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Ocultando ${numeroAspectosMaximos - numeroAspectosActual} filas sobrantes para Caso ${numeroCaso}`);
      }
      for (let i = numeroAspectosMaximos - 1; i >= numeroAspectosActual; i--) {
        const filaAspecto = filasAspectos[i];
        const filaEspaciado = filaAspecto + 1;
        try {
          const rowAspecto = ws.getRow(filaAspecto);
          const rowEspaciado = ws.getRow(filaEspaciado);
          rowAspecto.eachCell((cell) => { cell.value = ''; });
          rowEspaciado.eachCell((cell) => { cell.value = ''; });
          rowAspecto.hidden = true;
          rowEspaciado.hidden = true;
          if (process.env.NODE_ENV !== 'production') {
            console.log(`Ocultadas filas ${filaAspecto} y ${filaEspaciado}`);
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Error ocultando filas del aspecto ${i + 1} en Caso ${numeroCaso}:`, error);
          }
        }
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Caso ${numeroCaso} completado`);
    }
  }
  
  // Ocultar los casos que no existen (si solo hay 1 caso, ocultar casos 2 y 3)
  const totalCasos = args.casos.length;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Total de casos reales: ${totalCasos}, ocultando casos no utilizados...`);
  }
  
  // Definir bloques de filas para cada caso
  const bloquesDelCaso: Record<number, number[]> = {
    2: [45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74],
    3: [75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104]
  };
  
  // Ocultar casos que no existen
  for (let casoNumero = totalCasos + 1; casoNumero <= 3; casoNumero++) {
    if (bloquesDelCaso[casoNumero]) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Ocultando todo el bloque del Caso ${casoNumero} (no utilizado)`);
      }
      for (const fila of bloquesDelCaso[casoNumero]) {
        try {
          const row = ws.getRow(fila);
          row.eachCell((cell) => { cell.value = ''; });
          row.hidden = true;
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Error ocultando fila ${fila} del Caso ${casoNumero}:`, error);
          }
        }
      }
    }
  }
  
  // Agregar sección final con información del especialista en posiciones fijas
  const filaEspecialista = 60; // Posición fija para el nombre del especialista
  
  // Nombre del especialista
  if (args.encabezado.nombreEspecialista) {
    ws.getCell(`C${filaEspecialista}`).value = args.encabezado.nombreEspecialista;
    ws.getCell(`C${filaEspecialista}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`C${filaEspecialista}`).font = { bold: true };
  }
  
  // Texto de firma
  const filaFirma = filaEspecialista + 2;
  ws.getCell(`C${filaFirma}`).value = "NOMBRE Y FIRMA DE LA PERSONA ESPECIALISTA";
  ws.getCell(`C${filaFirma}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(`C${filaFirma}`).font = { bold: true };
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Todos los casos procesados en una sola hoja`);
  }

  // Generar el buffer del archivo Excel
  const tmpDir = path.resolve(__dirname, `../../tmp`);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const tmp = path.resolve(tmpDir, `FE-Conjunto-${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(tmp);
  const buf = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  
  return buf;
}
