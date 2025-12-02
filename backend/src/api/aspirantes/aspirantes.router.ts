// src/api/aspirantes/aspirantes.router.ts
import { Router } from "express";
import Aspirante from "../../models/Aspirante";
import Convocatoria from "../../models/Convocatoria";
import Concurso from "../../models/Concurso";
import { validateQueryStrings } from "../../middleware/validateRequest";

const router = Router();

/**
 * GET /api/aspirantes/_debug/ping
 * Debug endpoint para verificar conexión
 */
router.get("/_debug/ping", async (req, res) => {
  try {
    const count = await Aspirante.countDocuments();
    const sample = await Aspirante.findOne().lean();
    
    return res.json({
      ok: true,
      totalAspirantes: count,
      sampleAspirante: sample,
      collectionName: Aspirante.collection.name,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/aspirantes/by-plaza
 * Obtiene aspirantes filtrados por convocatoriaId, concursoId 
 * Query params:
 * - convocatoriaId: ID de la convocatoria
 * - concursoId: ID del concurso
 * - plazaId: (opcional) ID de la plaza para filtros adicionales
 */
router.get("/by-plaza", validateQueryStrings('convocatoriaId', 'concursoId'), async (req, res, next) => {
  try {
    const { convocatoriaId, concursoId, plazaId } = req.query;

    // Validar tipos para prevenir NoSQL injection
    if (typeof convocatoriaId !== 'string' || typeof concursoId !== 'string') {
      return res.status(400).json({ 
        message: 'Parámetros inválidos' 
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [aspirantes/by-plaza] Parámetros recibidos:', {
        convocatoriaId,
        concursoId,
        plazaId
      });
    }

    if (!convocatoriaId || !concursoId) {
      return res.status(400).json({ 
        message: 'convocatoriaId y concursoId son requeridos' 
      });
    }

    // Debug: Obtener algunos aspirantes de ejemplo para verificar estructura (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production') {
      const sampleAspirantes = await Aspirante.collection.find().limit(3).toArray();
      console.log('📋 Ejemplos de aspirantes en BD:', JSON.stringify(sampleAspirantes.map(a => ({
        _id: a._id,
        convocatoriaId: a.convocatoriaId,
        concursoId: a.concursoId,
        folio: a.folio
      })), null, 2));
    }

    // Buscar el concurso para obtener sus variantes
    const Concurso = (await import('../../models/Concurso')).default;
    let concursoDoc = null;
    try {
      // Usar collection.findOne() para evitar cast a ObjectId
      concursoDoc = await Concurso.collection.findOne({
        $or: [
          { _id: concursoId },
          { concurso_id: concursoId }
        ]
      });
    } catch (err) {
      console.log('⚠️ [aspirantes] Error buscando concurso:', err);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('📋 [aspirantes] Concurso encontrado:', concursoDoc);
    }

    // Buscar la convocatoria para obtener sus variantes
    const Convocatoria = (await import('../../models/Convocatoria')).default;
    let convocatoriaDoc = null;
    try {
      // Usar collection.findOne() para evitar cast a ObjectId
      convocatoriaDoc = await Convocatoria.collection.findOne({
        $or: [
          { _id: convocatoriaId },
          { nombre: convocatoriaId }
        ]
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️ [aspirantes] Error buscando convocatoria:', err);
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('📋 [aspirantes] Convocatoria encontrada:', convocatoriaDoc);
    }

    // Construir arrays de posibles valores para convocatoriaId
    const possibleConvocatoriaIds = [String(convocatoriaId)];
    if (convocatoriaDoc) {
      if (convocatoriaDoc._id && String(convocatoriaDoc._id) !== String(convocatoriaId)) {
        possibleConvocatoriaIds.push(String(convocatoriaDoc._id));
      }
      if (convocatoriaDoc.nombre) {
        possibleConvocatoriaIds.push(String(convocatoriaDoc.nombre));
      }
    }

    // Construir arrays de posibles valores para concursoId
    const possibleConcursoIds = [String(concursoId)];
    if (concursoDoc) {
      if (concursoDoc._id && String(concursoDoc._id) !== String(concursoId)) {
        possibleConcursoIds.push(String(concursoDoc._id));
      }
      if (concursoDoc.concurso_id && !possibleConcursoIds.includes(String(concursoDoc.concurso_id))) {
        possibleConcursoIds.push(String(concursoDoc.concurso_id));
      }
      if (concursoDoc.nombre && !possibleConcursoIds.includes(String(concursoDoc.nombre))) {
        possibleConcursoIds.push(String(concursoDoc.nombre));
      }
    }
    
    // IMPORTANTE: También buscar todos los concursos que tengan el mismo nombre
    // porque los aspirantes pueden estar relacionados con concursos hermanos
    if (concursoDoc && concursoDoc.nombre) {
      try {
        const Concurso = (await import('../../models/Concurso')).default;
        const concursosRelacionados = await Concurso.collection.find(
          { nombre: concursoDoc.nombre },
          { projection: { _id: 1, concurso_id: 1 } }
        ).limit(50).toArray(); // Limitar a 50 concursos relacionados

        if (process.env.NODE_ENV !== 'production') {
          console.log(`📋 Concursos relacionados con nombre ${concursoDoc.nombre}:`, concursosRelacionados.length);
        }

        for (const conc of concursosRelacionados) {
          if (conc._id && !possibleConcursoIds.includes(String(conc._id))) {
            possibleConcursoIds.push(String(conc._id));
          }
          if (conc.concurso_id && !possibleConcursoIds.includes(String(conc.concurso_id))) {
            possibleConcursoIds.push(String(conc.concurso_id));
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('⚠️ Error buscando concursos relacionados:', err);
        }
      }
    }    // Buscar de forma flexible por todas las variantes posibles
    const query: any = {
      convocatoriaId: { $in: possibleConvocatoriaIds },
      concursoId: { $in: possibleConcursoIds }
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [aspirantes/by-plaza] Posibles convocatoriaIds:', possibleConvocatoriaIds);
      console.log('🔍 [aspirantes/by-plaza] Posibles concursoIds:', possibleConcursoIds);
    }

    const aspirantes = await Aspirante.find(query)
      .select('_id folio aspiranteName convocatoriaId concursoId')
      .sort({ folio: 1 })
      .limit(200)
      .lean();

    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔍 [aspirantes/by-plaza] Encontrados: ${aspirantes.length}`);
      if (aspirantes.length > 0) {
        console.log("🔍 [aspirantes/by-plaza] Primer resultado:", aspirantes[0]);
      }
    }

    // Formatear respuesta
    const formattedAspirantes = aspirantes.map(asp => ({
      _id: String(asp._id),
      folio: asp.folio,
      aspiranteName: asp.aspiranteName,
      nombre: asp.aspiranteName,
      label: `${asp.folio} - ${asp.aspiranteName}`,
      convocatoriaId: asp.convocatoriaId,
      concursoId: asp.concursoId,
    }));

    return res.json({
      total: aspirantes.length,
      aspirantes: formattedAspirantes,
    });
  } catch (error: any) {
    console.error("[aspirantes/by-plaza] Error completo:", error);
    console.error("[aspirantes/by-plaza] Stack:", error.stack);
    return res.status(500).json({ 
      message: "Error al buscar aspirantes",
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * GET /api/aspirantes/:id
 * Obtiene un aspirante específico por ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const aspirante = await Aspirante.findById(id).lean();
    
    if (!aspirante) {
      return res.status(404).json({ message: "Aspirante no encontrado" });
    }

    return res.json(aspirante);
  } catch (error: any) {
    console.error("[aspirantes] Error:", error.message);
    return res.status(500).json({ 
      message: "Error interno del servidor",
      error: error.message 
    });
  }
});

/**
 * POST /api/aspirantes
 * Crear nuevo aspirante
 */
router.post("/", async (req, res, next) => {
  try {
    const { 
      convocatoriaId, 
      concursoId, 
      plazaId,
      folio, 
      aspiranteName,
      convocatoriaName,
      concursoName 
    } = req.body;

    // Validaciones
    if (!folio || !folio.trim()) {
      return res.status(400).json({ message: "El folio es requerido" });
    }

    if (!aspiranteName || !aspiranteName.trim()) {
      return res.status(400).json({ message: "El nombre del aspirante es requerido" });
    }

    if (!convocatoriaId || !concursoId) {
      return res.status(400).json({ message: "Convocatoria y concurso son requeridos" });
    }

    // Verificar que el folio no exista
    const existingFolio = await Aspirante.findOne({ folio: folio.trim() });
    if (existingFolio) {
      return res.status(400).json({ message: "El folio ya existe" });
    }

    const newAspirante = new Aspirante({
      convocatoriaId,
      concursoId,
      plazaId: plazaId || undefined,
      folio: folio.trim(),
      aspiranteName: aspiranteName.trim(),
      aspiranteNameNorm: aspiranteName.trim().toLowerCase(),
      convocatoriaName: convocatoriaName?.trim() || convocatoriaId,
      concursoName: concursoName?.trim() || concursoId,
    });

    await newAspirante.save();

    return res.status(201).json({
      _id: String(newAspirante._id),
      convocatoriaId: newAspirante.convocatoriaId,
      concursoId: newAspirante.concursoId,
      plazaId: newAspirante.plazaId,
      folio: newAspirante.folio,
      aspiranteName: newAspirante.aspiranteName,
      convocatoriaName: newAspirante.convocatoriaName,
      concursoName: newAspirante.concursoName,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "El folio ya existe" });
    }
    console.error("[aspirantes] Error:", error.message);
    return res.status(500).json({ 
      message: "Error interno del servidor",
      error: error.message 
    });
  }
});

/**
 * PUT /api/aspirantes/:id
 * Actualizar aspirante existente
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      convocatoriaId, 
      concursoId, 
      plazaId,
      folio, 
      aspiranteName,
      convocatoriaName,
      concursoName 
    } = req.body;

    // Validaciones
    if (!folio || !folio.trim()) {
      return res.status(400).json({ message: "El folio es requerido" });
    }

    if (!aspiranteName || !aspiranteName.trim()) {
      return res.status(400).json({ message: "El nombre del aspirante es requerido" });
    }

    if (!convocatoriaId || !concursoId) {
      return res.status(400).json({ message: "Convocatoria y concurso son requeridos" });
    }

    // Verificar que el folio no exista en otro aspirante
    const existingFolio = await Aspirante.findOne({ 
      folio: folio.trim(),
      _id: { $ne: id }
    });
    
    if (existingFolio) {
      return res.status(400).json({ message: "El folio ya existe en otro aspirante" });
    }

    const updated = await Aspirante.findByIdAndUpdate(
      id,
      {
        convocatoriaId,
        concursoId,
        plazaId: plazaId || undefined,
        folio: folio.trim(),
        aspiranteName: aspiranteName.trim(),
        aspiranteNameNorm: aspiranteName.trim().toLowerCase(),
        convocatoriaName: convocatoriaName?.trim() || convocatoriaId,
        concursoName: concursoName?.trim() || concursoId,
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Aspirante no encontrado" });
    }

    return res.json({
      _id: String(updated._id),
      convocatoriaId: updated.convocatoriaId,
      concursoId: updated.concursoId,
      plazaId: updated.plazaId,
      folio: updated.folio,
      aspiranteName: updated.aspiranteName,
      convocatoriaName: updated.convocatoriaName,
      concursoName: updated.concursoName,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "El folio ya existe" });
    }
    console.error("[aspirantes] Error:", error.message);
    return res.status(500).json({ 
      message: "Error interno del servidor",
      error: error.message 
    });
  }
});

/**
 * DELETE /api/aspirantes/:id
 * Eliminar aspirante
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { confirmacion } = req.body;

    // Validar confirmación
    if (confirmacion !== 'DELETE') {
      return res.status(400).json({ 
        message: 'Debe escribir DELETE para confirmar la eliminación' 
      });
    }

    const deleted = await Aspirante.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Aspirante no encontrado" });
    }

    return res.status(204).send();
  } catch (error: any) {
    console.error("[aspirantes] Error:", error.message);
    return res.status(500).json({ 
      message: "Error interno del servidor",
      error: error.message 
    });
  }
});

export default router;