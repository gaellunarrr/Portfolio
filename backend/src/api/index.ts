import { Router } from 'express';
import healthRouter from './health/health.router';
import catalogRouter from './catalog/catalog.router';
import plazasRouter from './plazas/plazas.router';
import linksRouter from './links/links.router';
import prefillRouter from './exams/prefill.router';
import examsRouter from './exams/exams.router';
import consentsRouter from './consents/consents.router';
import aspirantesRouter from './aspirantes/aspirantes.router';

// ⬇⬇⬇ NUEVOS ⬇⬇⬇
import estructuraRouter from './estructura/estructura.router';
import artifactsRouter from './artifacts/artifacts.router';
import especialistasRouter from './especialistas/especialistas.router';
import convocatoriasRouter from './convocatorias/convocatorias.router';
import concursosRouter from './concursos/concursos.router';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/catalog', catalogRouter);
apiRouter.use('/plazas', plazasRouter);
apiRouter.use('/links', linksRouter);
apiRouter.use('/aspirantes', aspirantesRouter);

// Exams (prefill primero para que capture /exams/prefill antes de /exams/:id)
apiRouter.use('/exams', prefillRouter);
apiRouter.use('/exams', examsRouter);

// Consents
apiRouter.use('/consents', consentsRouter);

// ⬇⬇⬇ NUEVOS ENDPOINTS QUE USA EL FE ⬇⬇⬇
apiRouter.use('/estructura', estructuraRouter);
apiRouter.use('/artifacts', artifactsRouter);

// ⬇⬇⬇ CRUD ENDPOINTS DE ADMINISTRACIÓN ⬇⬇⬇
apiRouter.use('/especialistas', especialistasRouter);
apiRouter.use('/convocatorias', convocatoriasRouter);
apiRouter.use('/concursos', concursosRouter);
