import {jsPDF} from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = {
    headerBg: [22, 101, 52] as [number, number, number],      // green-800
    headerText: [255, 255, 255] as [number, number, number],
    altRow: [241, 245, 249] as [number, number, number],      // slate-100
    accent: [34, 197, 94] as [number, number, number],        // green-500
    textDark: [30, 41, 59] as [number, number, number],
    textMuted: [100, 116, 139] as [number, number, number],   // slate-500
    nameBg: [226, 232, 240] as [number, number, number],      // slate-200
    nameText: [30, 41, 59] as [number, number, number],       // slate-800
};

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(22);
    doc.setTextColor(...COLORS.textDark);
    doc.text(title, 14, 22);

    if (subtitle) {
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.textMuted);
        doc.text(subtitle, 14, 30);
    }

    // accent line
    doc.setDrawColor(...COLORS.accent);
    doc.setLineWidth(0.8);
    doc.line(14, subtitle ? 34 : 28, pageWidth - 14, subtitle ? 34 : 28);
}

function addPageNumbers(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.textMuted);
        doc.text(`Page ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 10, {align: "right"});
    }
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("fr-FR", {day: "2-digit", month: "2-digit", year: "numeric"});
}

export function generateFullRecapPDF(users: User[], distributions: DistributionCardDTO[]): void {
    const doc = new jsPDF();

    addHeader(doc, "Rapport de distributions", `Généré le ${new Date().toLocaleDateString("fr-FR")}`);

    // --- Summary block ---
    const totalParts = distributions.reduce((sum, d) => sum + d.assignments.reduce((s, a) => s + a.quantity, 0), 0);
    const participantIds = new Set(distributions.flatMap(d => d.participants.map(p => p.user.id)));

    let y = 42;
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.textDark);
    doc.text(`Nombre de distributions : ${distributions.length}`, 14, y);
    doc.text(`Total parts distribuées : ${totalParts}`, 14, y + 6);
    doc.text(`Nombre de participants : ${participantIds.size}`, 14, y + 12);
    y += 22;

    // --- Per-user totals table ---
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.textDark);
    doc.text("Totaux par participant", 14, y);
    y += 4;

    const userTotals = users.map(u => {
        const parts: Record<number, { name: string; qty: number; object: string; type: string }> = {};
        distributions.forEach(d => {
            d.assignments.filter(a => a.user.id === u.id).forEach(a => {
                if (parts[a.part.id]) {
                    parts[a.part.id].qty += a.quantity;
                } else {
                    parts[a.part.id] = {name: a.part.name, qty: a.quantity, object: a.part.object.name, type: a.type.name};
                }
            });
        });
        const totalQty = Object.values(parts).reduce((s, p) => s + p.qty, 0);
        const breakdown = Object.values(parts).map(p => `${p.name} ×${p.qty} — ${p.object} / ${p.type}`).join("\n") || "—";
        return [`${u.firstName} ${u.lastName}`, String(totalQty), breakdown];
    });

    autoTable(doc, {
        startY: y,
        head: [["Participant", "Total", "Détail"]],
        body: userTotals,
        styles: {fontSize: 9, cellPadding: 3},
        headStyles: {fillColor: COLORS.headerBg, textColor: COLORS.headerText, fontStyle: "bold"},
        alternateRowStyles: {fillColor: COLORS.altRow},
        columnStyles: {
            0: {cellWidth: 45},
            1: {cellWidth: 20, halign: "center"},
            2: {cellWidth: "auto"},
        },
    });

    // --- Per-distribution detail ---
    distributions.forEach(d => {
        // @ts-expect-error autoTable adds lastAutoTable
        y = (doc as any).lastAutoTable?.finalY + 12 || doc.internal.pageSize.getHeight() - 30;

        // Check if we need a new page
        if (y > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            y = 20;
        }

        doc.setFontSize(13);
        doc.setTextColor(...COLORS.textDark);
        doc.text(`${d.name}`, 14, y);
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.textMuted);
        doc.text(formatDate(d.createdAt), 14, y + 5);

        const participantNames = d.participants.map(p => `${p.user.firstName} ${p.user.lastName}`).join(", ");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.textMuted);
        doc.text(`Participants : ${participantNames}`, 14, y + 10);
        y += 16;

        const byUser: Record<number, { name: string; total: number; rows: string[][] }> = {};
        d.assignments.forEach(a => {
            const uid = a.user.id;
            if (!byUser[uid]) byUser[uid] = {name: `${a.user.firstName} ${a.user.lastName}`, total: 0, rows: []};
            byUser[uid].total += a.quantity;
            byUser[uid].rows.push([a.part.name, `${a.part.object.name} / ${a.type.name}`, String(a.quantity)]);
        });

        const rows: string[][] = [];
        const nameRowIndices = new Set<number>();
        Object.values(byUser).forEach(u => {
            nameRowIndices.add(rows.length);
            rows.push([u.name, "", "", String(u.total)]);
            u.rows.forEach(r => {
                rows.push(["", ...r]);
            });
        });

        if (rows.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [["Participant", "Part", "Objet / Type", "Qté"]],
                body: rows,
                styles: {fontSize: 9, cellPadding: 3},
                headStyles: {fillColor: COLORS.headerBg, textColor: COLORS.headerText, fontStyle: "bold"},
                alternateRowStyles: {fillColor: COLORS.altRow},
                columnStyles: {
                    0: {cellWidth: 50},
                    3: {halign: "center", cellWidth: 20},
                },
                didParseCell(data) {
                    if (data.section === "body" && nameRowIndices.has(data.row.index)) {
                        data.cell.styles.fillColor = COLORS.nameBg;
                        data.cell.styles.textColor = COLORS.nameText;
                        data.cell.styles.fontStyle = "bold";
                    }
                },
            });
        } else {
            doc.setFontSize(9);
            doc.setTextColor(...COLORS.textMuted);
            doc.text("Aucune attribution", 14, y);
            // Move y forward so next section doesn't overlap
            // @ts-expect-error autoTable tracking
            (doc as any).lastAutoTable = {finalY: y + 6};
        }
    });

    addPageNumbers(doc);
    doc.save("rapport-distributions.pdf");
}

export function generateDistributionPDF(distribution: DistributionCardDTO): void {
    const doc = new jsPDF();

    addHeader(doc, distribution.name, `Distribution du ${formatDate(distribution.createdAt)}`);

    let y = 42;

    // Participants
    const participantNames = distribution.participants.map(p => `${p.user.firstName} ${p.user.lastName}`).join(", ");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`Participants : ${participantNames}`, 14, y);
    y += 10;

    // Assignments grouped by user
    const byUser: Record<number, { name: string; total: number; rows: string[][] }> = {};
    distribution.assignments.forEach(a => {
        const uid = a.user.id;
        if (!byUser[uid]) byUser[uid] = {name: `${a.user.firstName} ${a.user.lastName}`, total: 0, rows: []};
        byUser[uid].total += a.quantity;
        byUser[uid].rows.push([a.part.name, `${a.part.object.name} / ${a.type.name}`, String(a.quantity)]);
    });

    const allRows: string[][] = [];
    const nameRowIndices = new Set<number>();
    Object.values(byUser).forEach(u => {
        nameRowIndices.add(allRows.length);
        allRows.push([u.name, "", "", String(u.total)]);
        u.rows.forEach(r => {
            allRows.push(["", ...r]);
        });
    });

    if (allRows.length > 0) {
        autoTable(doc, {
            startY: y,
            head: [["Participant", "Part", "Objet / Type", "Qté"]],
            body: allRows,
            styles: {fontSize: 9, cellPadding: 3},
            headStyles: {fillColor: COLORS.headerBg, textColor: COLORS.headerText, fontStyle: "bold"},
            alternateRowStyles: {fillColor: COLORS.altRow},
            columnStyles: {
                0: {cellWidth: 45},
                3: {halign: "center", cellWidth: 20},
            },
            didParseCell(data) {
                if (data.section === "body" && nameRowIndices.has(data.row.index)) {
                    data.cell.styles.fillColor = COLORS.nameBg;
                    data.cell.styles.textColor = COLORS.nameText;
                    data.cell.styles.fontStyle = "bold";
                }
            },
        });
    } else {
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.textMuted);
        doc.text("Aucune attribution pour cette distribution.", 14, y);
    }

    addPageNumbers(doc);
    doc.save(`distribution-${distribution.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}
