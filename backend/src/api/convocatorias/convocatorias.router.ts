// src/api/convocatorias/convocatorias.router.ts
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Convocatoria from '../../models/Convocatoria';

const router = Router();

/* ---------- GET - Listar todas las convocatorias ---------- */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const convocatorias = await Convocatoria
      .find({})
      .sort({ createdAt: -1 })
      .lean();

    res.set('Cache-Control', 'no-store');

    const out = convocatorias.map((conv: any) => ({
      _id: String(conv._id),
      nombre: conv.nombre || '',
    }));

    return res.json(out);
  } catch (err) {
    next(err);
  }
});

/* ---------- GET /:id - Obtener una convocatoria por ID ---------- */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const convocatoria = await Convocatoria.findById(id).lean();

    if (!convocatoria) {
      return res.status(404).json({ message: 'Convocatoria no encontrada' });
    }

    return res.json({
      _id: String(convocatoria._id),
      nombre: (convocatoria as any).nombre,
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- POST - Crear nueva convocatoria ---------- */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre } = req.body;

    // Validaciones
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }

    // Generar hash único de 40 caracteres
    const hash = crypto.randomBytes(20).toString('hex');

    const newConvocatoria = new Convocatoria({
      _id: hash,
      nombre: nombre.trim(),
    });

    await newConvocatoria.save();

    return res.status(201).json({
      _id: hash,
      nombre: newConvocatoria.nombre,
    });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'El código de convocatoria ya existe' });
    }
    next(err);
  }
});

/* ---------- PUT /:id - Actualizar convocatoria ---------- */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    // Validaciones
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }

    const updated = await Convocatoria.findByIdAndUpdate(
      id,
      {
        nombre: nombre.trim(),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Convocatoria no encontrada' });
    }

    return res.json({
      _id: String(updated._id),
      nombre: (updated as any).nombre,
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- DELETE /:id - Eliminar convocatoria ---------- */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { confirmacion } = req.body;

    // Validar confirmación
    if (confirmacion !== 'DELETE') {
      return res.status(400).json({ 
        message: 'Debe escribir DELETE para confirmar la eliminación' 
      });
    }

    // Verificar si hay concursos o plazas asociados
    const Concurso = require('../../models/Concurso').default;
    const Plaza = require('../../models/Plaza').default;
    
    const concursosCount = await Concurso.countDocuments({
      $or: [
        { convocatoriaId: id },
        { convocatoria_id: id },
        { convocatoria: id },
      ],
    });

    if (concursosCount > 0) {
      return res.status(400).json({ 
        message: `No se puede eliminar. La convocatoria tiene ${concursosCount} concurso(s) asociado(s)` 
      });
    }

    // Verificar si hay plazas asociadas
    const plazasCount = await Plaza.countDocuments({
      convocatoria: id
    });

    if (plazasCount > 0) {
      return res.status(400).json({ 
        message: `No se puede eliminar. La convocatoria tiene ${plazasCount} plaza(s) asociada(s)` 
      });
    }

    const deleted = await Convocatoria.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Convocatoria no encontrada' });
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
