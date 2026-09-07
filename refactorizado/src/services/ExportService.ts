import { PATHS } from '../config/index.js';
import { xlsx, readWorkbook, getOrInitWorkingWorkbook, obtenerNombreAlumno } from '../data/xlsx.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename, parse } from 'node:path';
import { stateManager } from '../core/StateManager.js';
import { CourseService } from './CourseService.js';
import { isFullyRegistered } from '../utils/validation.js';

export interface ExportData {
  cursoName: string;
  alumnos: Array<{
    id: number;
    nombreCompleto: string;
    completado: string;
    email: string;
    dni: string;
    titulo: string;
    tecnologia: string;
    grupo: string;
    telefono: string;
    fechaRegistro: string;
    [key: string]: string | number;
  }>;
  gruposMap: Record<string, Array<{
    nombreCompleto: string;
    titulo: string;
    email: string;
  }>>;
  statsTitulos: Record<string, number>;
  statsTech: Record<string, number>;
}

export class ExportService {
  static getCourseExportData(cursoName: string): ExportData | null {
    if (!cursoName) return null;
    const safeCurso = basename(cursoName);
    const filePath = getOrInitWorkingWorkbook(cursoName);
    if (!filePath || !existsSync(filePath)) return null;

    const workbook = readWorkbook(filePath);
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const alumnos: ExportData['alumnos'] = [];
    const gruposMap: ExportData['gruposMap'] = {};
    const statsTitulos: ExportData['statsTitulos'] = {};
    const statsTech: ExportData['statsTech'] = { AVANZADO: 0, MODERADO: 0, TEMEROSO: 0 };

    data.forEach((row: any, index: number) => {
      const name = obtenerNombreAlumno(row);
      if (!name || name.toLowerCase() === 'nombre' || name.toLowerCase() === 'full name') return;

      const completado = isFullyRegistered(row);
      const grupo = (row['Grupo'] || '').toString().trim().toUpperCase();

      const alumnoObj: ExportData['alumnos'][0] = {
        id: index + 1,
        nombreCompleto: name.trim(),
        completado: completado ? 'SI' : 'NO',
        email: row['Email Privado'] || '',
        dni: row['DNI'] || '',
        titulo: row['Título'] || row['Titulo'] || '',
        tecnologia: row['Tecnología'] || row['Tecnologia'] || '',
        grupo: grupo,
        telefono: row['Teléfono'] || '',
        fechaRegistro: row['Fecha Registro'] || ''
      };

      stateManager.formConfig?.customFields?.forEach(field => {
        const keyName = field.label || field.name;
        if (keyName) alumnoObj[keyName] = row[keyName] || '';
      });

      alumnos.push(alumnoObj);

      if (grupo) {
        if (!gruposMap[grupo]) gruposMap[grupo] = [];
        gruposMap[grupo].push(alumnoObj);
      }
      if (alumnoObj.titulo) {
        const t = alumnoObj.titulo.toUpperCase();
        statsTitulos[t] = (statsTitulos[t] || 0) + 1;
      }
      if (alumnoObj.tecnologia) {
        let tTech = alumnoObj.tecnologia.toUpperCase();
        if (tTech.includes('AVANZADO')) tTech = 'AVANZADO';
        else if (tTech.includes('MODERADO')) tTech = 'MODERADO';
        else if (tTech.includes('TEMEROSO')) tTech = 'TEMEROSO';
        if (statsTech[tTech] !== undefined) statsTech[tTech]++;
        else statsTech[tTech] = 1;
      }
    });

    return { cursoName: safeCurso, alumnos, gruposMap, statsTitulos, statsTech };
  }

  static exportExcel(curso: string): { buffer: Buffer; filename: string } {
    const exportData = this.getCourseExportData(curso);
    if (!exportData) throw new Error('No se pudo generar el reporte Excel.');

    const wb = xlsx.utils.book_new();
    const wsAlumnos = xlsx.utils.json_to_sheet(exportData.alumnos);
    xlsx.utils.book_append_sheet(wb, wsAlumnos, 'Alumnos');

    const gruposRows: Array<{ Grupo: string; 'Total Integrantes': number; Integrantes: string }> = [];
    Object.keys(exportData.gruposMap).sort().forEach(g => {
      const integrantes = exportData.gruposMap[g].map(a => `${a.nombreCompleto} (${a.titulo || 'Sin Título'})`).join(', ');
      gruposRows.push({ 'Grupo': g, 'Total Integrantes': exportData.gruposMap[g].length, 'Integrantes': integrantes });
    });
    const wsGrupos = xlsx.utils.json_to_sheet(gruposRows.length > 0 ? gruposRows : [{ 'Grupo': 'Sin Grupos', 'Total Integrantes': 0, 'Integrantes': '' }]);
    xlsx.utils.book_append_sheet(wb, wsGrupos, 'Grupos');

    const statsRows: Array<{ Categoría: string; Nombre: string; Cantidad: number }> = [];
    Object.entries(exportData.statsTitulos).forEach(([tit, cant]) => {
      statsRows.push({ 'Categoría': 'Título Profesional', 'Nombre': tit, 'Cantidad': cant });
    });
    Object.entries(exportData.statsTech).forEach(([tech, cant]) => {
      statsRows.push({ 'Categoría': 'Relación Tecnología', 'Nombre': tech, 'Cantidad': cant });
    });
    const wsStats = xlsx.utils.json_to_sheet(statsRows);
    xlsx.utils.book_append_sheet(wb, wsStats, 'Estadísticas');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const cleanName = parse(exportData.cursoName).name;
    return { buffer, filename: `Export_${cleanName}.xlsx` };
  }

  static exportWord(curso: string): { content: string; filename: string } {
    const exportData = this.getCourseExportData(curso);
    if (!exportData) throw new Error('No se pudo encontrar el curso.');

    const cleanName = parse(exportData.cursoName).name;
    const dateStr = new Date().toLocaleString('es-AR');
    const totalCompletados = exportData.alumnos.filter(a => a.completado === 'SI').length;
    const customHeaders = stateManager.formConfig?.customFields?.map(f => f.label || f.name) || [];

    function escapeHtml(value: any): string {
      return String(value == null ? '' : value)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, "'");
    }

    const tableRowsHtml = exportData.alumnos.map((a, i) => {
      const customCells = customHeaders.map(h => h ? `<td>${escapeHtml((a as Record<string, string>)[h]) || '-'}</td>` : '').join('');
      return `
        <tr>
          <td>${i + 1}</td>
          <td><b>${escapeHtml(a.nombreCompleto)}</b></td>
          <td>${escapeHtml(a.email) || '-'}</td>
          <td>${escapeHtml(a.dni) || '-'}</td>
          <td>${escapeHtml(a.titulo) || '-'}</td>
          <td>${escapeHtml(a.tecnologia) || '-'}</td>
          <td><b style="color: #4f46e5;">${escapeHtml(a.grupo) || '-'}</b></td>
          <td>${escapeHtml(a.telefono) || '-'}</td>
          ${customCells}
          <td><span style="color: ${a.completado === 'SI' ? '#16a34a' : '#9ca3af'}; font-weight: bold;">${escapeHtml(a.completado)}</span></td>
        </tr>
      `;
    }).join('');

    const gruposHtml = Object.keys(exportData.gruposMap).sort().map(g => {
      const members = exportData.gruposMap[g].map(m => `<li><b>${escapeHtml(m.nombreCompleto)}</b> - ${escapeHtml(m.titulo) || 'Sin Título'} (${escapeHtml(m.email) || 'Sin email'})</li>`).join('');
      return `
        <div style="margin-bottom: 15px;">
          <h3 style="color: #059669; margin-bottom: 5px;">👥 GRUPO: ${escapeHtml(g)} (${exportData.gruposMap[g].length} integrantes)</h3>
          <ul>${members}</ul>
        </div>
      `;
    }).join('') || '<p>No hay grupos formados aún.</p>';

    const customThs = customHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Reporte de Curso - ${escapeHtml(cleanName)}</title>
        <style>
          body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; margin: 30px; }
          h1 { color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; font-size: 20pt; }
          h2 { color: #0f172a; margin-top: 25px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-size: 14pt; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 20px; font-size: 10pt; }
          th { background-color: #f1f5f9; color: #0f172a; border: 1px solid #94a3b8; padding: 8px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .summary-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>📘 AulaInicial - Reporte del Curso: ${escapeHtml(cleanName)}</h1>
        <div class="summary-box">
          <p><b>Fecha de Exportación:</b> ${escapeHtml(dateStr)}</p>
          <p><b>Total de Alumnos:</b> ${exportData.alumnos.length} | <b>Registros Completados:</b> ${totalCompletados} | <b>Pendientes:</b> ${exportData.alumnos.length - totalCompletados}</p>
        </div>
        <h2>📋 Listado Completo de Alumnos</h2>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Nombre Completo</th><th>Email</th><th>DNI</th><th>Título</th><th>Tecnología</th><th>Grupo</th><th>Teléfono</th>${customThs}<th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
        <h2>👥 Conformación de Grupos</h2>
        ${gruposHtml}
      </body>
      </html>
    `;

    return { content: htmlContent, filename: `Reporte_${cleanName}.doc` };
  }

  static exportTexto(curso: string): { content: string; filename: string } {
    const exportData = this.getCourseExportData(curso);
    if (!exportData) throw new Error('No se pudo encontrar el curso.');

    const cleanName = parse(exportData.cursoName).name;
    const dateStr = new Date().toLocaleString('es-AR');
    let text = `====================================================\n`;
    text += `AULAINICIAL - REPORTE DE CURSO\n`;
    text += `Curso: ${cleanName}\n`;
    text += `Fecha: ${dateStr}\n`;
    text += `Total Alumnos: ${exportData.alumnos.length}\n`;
    text += `====================================================\n\n`;
    text += `--- LISTADO DE ALUMNOS ---\n`;
    exportData.alumnos.forEach((a, i) => {
      text += `${i + 1}. ${a.nombreCompleto.padEnd(30)} | DNI: ${(a.dni || 'S/D').padEnd(10)} | Email: ${(a.email || 'S/D').padEnd(25)} | Grupo: ${(a.grupo || 'S/G').padEnd(8)} | Estado: ${a.completado}\n`;
    });
    text += `\n--- INTEGRANTES POR GRUPO ---\n`;
    Object.keys(exportData.gruposMap).sort().forEach(g => {
      text += `\n[ GRUPO ${g} ] (${exportData.gruposMap[g].length} miembros)\n`;
      exportData.gruposMap[g].forEach(m => {
        text += `  - ${m.nombreCompleto} (${m.titulo || 'Sin título'}) - ${m.email || 'Sin email'}\n`;
      });
    });
    return { content: text, filename: `Reporte_${cleanName}.txt` };
  }
}