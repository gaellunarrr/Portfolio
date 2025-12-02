// src/api/catalog/catalog.router.ts
import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Convocatoria from '../../models/Convocatoria';
import Concurso from '../../models/Concurso';
import Especialista from '../../models/Especialista';

const router = Router();

const isOid = (v?: string) => !!v && Types.ObjectId.isValid(v);
const toOid = (v: string) => new Types.ObjectId(v);

/* ---------- Convocatorias ---------- */
router.get('/convocatorias', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await Convocatoria
      .find({})
      .lean();

    // Evita cacheo en dev (y que el front vea 304)
    res.set('Cache-Control', 'no-store');

    // Normaliza: { _id, nombre }
    const items = rows.map((r: any) => ({
      _id: String(r._id),
      nombre: (r.nombre ?? '').toString(),
    }));

    return res.json(items);
  } catch (err) {
    console.error('Error en GET /catalog/convocatorias:', err);
    next(err);
  }
});

/* ---------- Concursos ---------- */
router.get('/concursos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { convocatoriaId } = req.query as { convocatoriaId?: string };

    // Construye filtro tolerante a diferentes nombres de campo y tipos (ObjectId / string)
    const buildOrByConv = (id: string, asOid: boolean) => {
      const v = asOid ? toOid(id) : id;
      return [
        { convocatoriaId: v },
        { convId: v },
        { convocatoria_id: v },
        { convocatoria: v },
        { 'convocatoria._id': v },
        { convocatoriaCode: v },
      ];
    };

    let filter: any = {};
    if (convocatoriaId) {
      filter = {
        $or: [
          ...buildOrByConv(convocatoriaId, false),
          ...(isOid(convocatoriaId) ? buildOrByConv(convocatoriaId, true) : []),
        ],
      };
    }

    // Usamos el driver nativo para evitar CastError si llegan strings
    const rows = await Concurso.collection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.set('Cache-Control', 'no-store');

    // Normaliza: { _id, concurso_id, convocatoria_id, convocatoria, nombre }
    const out = rows.map((r: any) => ({
      _id: String(r._id),
      concurso_id: String(r.concurso_id ?? ''),
      convocatoria_id: String(r.convocatoria_id ?? ''),
      convocatoria: String(r.convocatoria ?? ''),
      nombre: Number(r.nombre) || 0,
    }));

    return res.json(out);
  } catch (err) {
    console.error('Error en GET /catalog/concursos:', err);
    next(err);
  }
});

/* ---------- Especialistas ---------- */
router.get('/especialistas', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await Especialista
      .find(
        { nombre: { $exists: true, $ne: '' } },
        { nombre: 1, correo: 1, puesto: 1 }
      )
      .lean();

    res.set('Cache-Control', 'no-store');

    // Normaliza: { _id, nombre, correo, puesto }
    const items = rows.map((r: any) => ({
      _id: String(r._id),
      nombre: (r.nombre ?? '').toString(),
      correo: (r.correo ?? '').toString(),
      puesto: (r.puesto ?? '').toString(),
    }));

    return res.json(items);
  } catch (err) {
    console.error('Error en GET /catalog/especialistas:', err);
    next(err);
  }
});

export default router;