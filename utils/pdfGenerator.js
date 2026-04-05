const fs = require('fs');
const path = require('path');

const escapePdfText = (value = '') => {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
};

const wrapText = (value, maxLength = 70) => {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [''];
};

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const buildPdfContent = (lines) => {
  let y = 800;
  const commands = ['BT', '/F1 12 Tf'];

  for (const line of lines) {
    commands.push(`72 ${y} Td (${escapePdfText(line)}) Tj`);
    commands.push(`0 -18 Td`);
    y -= 18;
  }

  commands.push('ET');
  return commands.join('\n');
};

const generatePrescriptionPdf = async ({ prescription, appointment, doctor, patient }) => {
  const outputDir = path.join(__dirname, '..', 'uploads', 'prescriptions');
  await ensureDir(outputDir);

  const lines = [
    'MANOVEDA DIGITAL PRESCRIPTION',
    '',
    `Prescription ID: ${prescription._id}`,
    `Date: ${new Date().toLocaleString('en-IN')}`,
    '',
    `Doctor: Dr. ${doctor.name || 'N/A'}`,
    `Specialization: ${doctor.specialization || 'General'}`,
    `Patient: ${patient.name || 'N/A'}`,
    `Consultation Type: ${appointment.type || 'video'} (${appointment.consultationMode || 'scheduled'})`,
    `Appointment Status: ${appointment.status || 'confirmed'}`,
    '',
    'Diagnosis:',
    ...wrapText(prescription.diagnosis || 'Not specified'),
    '',
    'Medicines:'
  ];

  prescription.medicines.forEach((medicine, index) => {
    lines.push(`${index + 1}. ${medicine.name || 'Medicine'}`);
    lines.push(`   Dosage: ${medicine.dosage || 'N/A'}`);
    lines.push(`   Frequency: ${medicine.frequency || 'N/A'}`);
    lines.push(`   Duration: ${medicine.duration || 'N/A'}`);
    if (medicine.instructions) {
      wrapText(`   Notes: ${medicine.instructions}`, 66).forEach((line) => lines.push(line));
    }
  });

  lines.push('');
  lines.push('Doctor Notes:');
  wrapText(prescription.notes || 'No additional notes.').forEach((line) => lines.push(line));

  if (prescription.followUpDate) {
    lines.push('');
    lines.push(`Follow-up: ${new Date(prescription.followUpDate).toLocaleString('en-IN')}`);
  }

  const contentStream = buildPdfContent(lines);
  const objects = [];

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  objects.push(`5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

  let pdf = '%PDF-1.4\n';
  const xrefPositions = [0];

  for (const object of objects) {
    xrefPositions.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += object;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  xrefPositions.slice(1).forEach((position) => {
    pdf += `${String(position).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const fileName = `prescription-${prescription._id}.pdf`;
  const filePath = path.join(outputDir, fileName);
  await fs.promises.writeFile(filePath, pdf, 'binary');

  return {
    fileName,
    filePath,
    publicUrl: `/uploads/prescriptions/${fileName}`
  };
};

module.exports = {
  generatePrescriptionPdf
};
