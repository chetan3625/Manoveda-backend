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
  const commands = ['0.5 w', '0 G', '72 760 m', '523 760 l', 'S', 'BT'];

  for (const line of lines) {
    commands.push(`/${line.font || 'F1'} ${line.size || 12} Tf`);
    commands.push(`1 0 0 1 ${line.x} ${line.y} Tm`);
    commands.push(`(${escapePdfText(line.text)}) Tj`);
  }

  commands.push('ET');
  return commands.join('\n');
};

const generatePrescriptionPdf = async ({ prescription, appointment, doctor, patient }) => {
  const outputDir = path.join(__dirname, '..', 'uploads', 'prescriptions');
  await ensureDir(outputDir);

  const createdAt = appointment?.createdAt ? new Date(appointment.createdAt) : new Date();
  const prescriptionDate = new Date();

  const doctorName = doctor?.name ? `Dr. ${doctor.name}` : 'Dr. N/A';
  const patientName = patient?.name || 'N/A';
  const specialization = doctor?.specialization || 'General Medicine';
  const appointmentType = appointment?.type || 'Video';
  const consultationMode = appointment?.consultationMode || 'Scheduled';
  const appointmentStatus = appointment?.status || 'Confirmed';

  const contentLines = [];
  contentLines.push({ text: 'MANOVEDA', font: 'F2', size: 26, x: 72, y: 800 });
  contentLines.push({ text: 'Mental Health & Wellness Care', font: 'F1', size: 10, x: 72, y: 782 });
  contentLines.push({ text: 'Digital Prescription', font: 'F2', size: 14, x: 72, y: 764 });
  contentLines.push({ text: 'Manoveda Team', font: 'F1', size: 9, x: 72, y: 748 });
  contentLines.push({ text: `Prescription ID: ${prescription._id}`, font: 'F1', size: 10, x: 72, y: 726 });
  contentLines.push({ text: `Date: ${prescriptionDate.toLocaleDateString('en-IN')} ${prescriptionDate.toLocaleTimeString('en-IN')}`, font: 'F1', size: 10, x: 350, y: 726 });

  let yPosition = 706;
  contentLines.push({ text: '-----------------------------------------------------------', font: 'F1', size: 10, x: 72, y: yPosition });

  yPosition -= 18;
  contentLines.push({ text: `Doctor: ${doctorName}`, font: 'F2', size: 11, x: 72, y: yPosition });
  yPosition -= 16;
  contentLines.push({ text: `Specialization: ${specialization}`, font: 'F1', size: 10, x: 72, y: yPosition });
  yPosition -= 16;
  contentLines.push({ text: `Patient: ${patientName}`, font: 'F2', size: 11, x: 72, y: yPosition });
  yPosition -= 16;
  contentLines.push({ text: `Consultation: ${appointmentType} (${consultationMode})`, font: 'F1', size: 10, x: 72, y: yPosition });
  yPosition -= 16;
  contentLines.push({ text: `Appointment Status: ${appointmentStatus}`, font: 'F1', size: 10, x: 72, y: yPosition });

  yPosition -= 26;
  contentLines.push({ text: 'Diagnosis', font: 'F2', size: 12, x: 72, y: yPosition });
  yPosition -= 18;
  wrapText(prescription.diagnosis || 'Not specified', 90).forEach((line) => {
    contentLines.push({ text: line, font: 'F1', size: 10, x: 72, y: yPosition });
    yPosition -= 14;
  });

  yPosition -= 12;
  contentLines.push({ text: 'Medicines', font: 'F2', size: 12, x: 72, y: yPosition });
  yPosition -= 18;
  prescription.medicines.forEach((medicine, index) => {
    contentLines.push({ text: `${index + 1}. ${medicine.name || 'Medicine'}`, font: 'F1', size: 10, x: 72, y: yPosition });
    yPosition -= 14;
    contentLines.push({ text: `Dosage: ${medicine.dosage || 'N/A'}`, font: 'F1', size: 10, x: 90, y: yPosition });
    yPosition -= 14;
    contentLines.push({ text: `Frequency: ${medicine.frequency || 'N/A'}`, font: 'F1', size: 10, x: 90, y: yPosition });
    yPosition -= 14;
    contentLines.push({ text: `Duration: ${medicine.duration || 'N/A'}`, font: 'F1', size: 10, x: 90, y: yPosition });
    yPosition -= 14;
    if (medicine.instructions) {
      wrapText(`Notes: ${medicine.instructions}`, 80).forEach((line) => {
        contentLines.push({ text: line, font: 'F1', size: 10, x: 90, y: yPosition });
        yPosition -= 14;
      });
    }
    yPosition -= 6;
  });

  yPosition -= 8;
  contentLines.push({ text: 'Doctor Notes', font: 'F2', size: 12, x: 72, y: yPosition });
  yPosition -= 18;
  wrapText(prescription.notes || 'No additional notes.', 90).forEach((line) => {
    contentLines.push({ text: line, font: 'F1', size: 10, x: 72, y: yPosition });
    yPosition -= 14;
  });

  if (prescription.followUpDate) {
    yPosition -= 12;
    contentLines.push({ text: `Follow-up: ${new Date(prescription.followUpDate).toLocaleDateString('en-IN')} ${new Date(prescription.followUpDate).toLocaleTimeString('en-IN')}`, font: 'F1', size: 10, x: 72, y: yPosition });
  }

  contentLines.push({ text: 'Thank you for choosing Manoveda.', font: 'F1', size: 9, x: 72, y: 90 });
  contentLines.push({ text: 'Stay safe and follow the prescription carefully.', font: 'F1', size: 9, x: 72, y: 76 });

  const contentStream = buildPdfContent(contentLines);
  const objects = [];

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');
  objects.push(`6 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

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
