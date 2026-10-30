import { jsPDF } from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';
import type {
  InstitutionalReportData,
  ReportFilterOptions,
} from '@/lib/institutionalReportEngine';

export interface PDFReportOptions {
  showWinningColleges?: boolean;
  showStandings?: boolean;
  showMvpRecords?: boolean;
  showParticipation?: boolean;
}

// Color palette for official PSU SportsTrack vector PDF generation
const COLOR_NAVY: [number, number, number] = [15, 23, 42]; // #0f172a
const COLOR_ORANGE: [number, number, number] = [234, 88, 12]; // #ea580c
const COLOR_SLATE_MUTED: [number, number, number] = [100, 116, 139]; // #64748b
const COLOR_SLATE_DARK: [number, number, number] = [30, 41, 59]; // #1e293b
const COLOR_BORDER: [number, number, number] = [226, 232, 240]; // #e2e8f0
const COLOR_BG_ALT: [number, number, number] = [248, 250, 252]; // #f8fafc

const COMMON_TABLE_STYLES: Partial<UserOptions> = {
  theme: 'grid',
  headStyles: {
    fillColor: COLOR_NAVY,
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    fontSize: 7.5,
    cellPadding: 2,
    lineColor: COLOR_BORDER,
    lineWidth: 0.1,
  },
  alternateRowStyles: {
    fillColor: COLOR_BG_ALT,
  },
  styles: {
    font: 'helvetica',
    fontSize: 7,
    textColor: COLOR_SLATE_DARK,
    cellPadding: 2,
    lineColor: COLOR_BORDER,
    lineWidth: 0.1,
    overflow: 'linebreak',
    valign: 'middle',
  },
  margin: { left: 14, right: 14, top: 18, bottom: 15 },
  pageBreak: 'auto',
  showHead: 'everyPage',
};

/**
 * Draws a stylized section header banner with orange accent bar.
 * Breaks to a new page if remaining vertical space is insufficient
 * for both the header and at least two table rows (anti-orphan protection).
 */
function renderSectionHeader(
  doc: jsPDF,
  currentY: number,
  title: string,
  subtitle?: string,
  badgeText?: string
): number {
  if (currentY > 150) {
    doc.addPage();
    currentY = 18;
  }

  // Accent bar
  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(14, currentY, 3, 8, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(title, 19, currentY + 5.5);

  // Optional badge
  if (badgeText) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_ORANGE);
    doc.text(badgeText, 283, currentY + 5.5, { align: 'right' });
  }

  currentY += 9.5;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_SLATE_MUTED);
    doc.text(subtitle, 19, currentY);
    currentY += 4.5;
  }

  return currentY;
}

/**
 * Programmatically generates and initiates direct vector PDF download
 * for FR-43 Institutional Athletic Reports.
 */
export async function generateInstitutionalReportPDF(
  reportData: InstitutionalReportData,
  filters: ReportFilterOptions,
  adminName: string = 'Administrator',
  options: PDFReportOptions = {}
): Promise<string> {
  const {
    showWinningColleges = true,
    showStandings = true,
    showMvpRecords = true,
    showParticipation = true,
  } = options;

  // Create A4 Landscape vector document (297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  doc.setProperties({
    title: `PSU SportsTrack Institutional Report - ${reportData.metadata.academicYear}`,
    subject: 'Official Athletic Performance & Compliance Dossier (FR-43)',
    author: adminName,
    creator: 'Palawan State University SportsTrack System',
  });

  // =========================================================================
  // PAGE 1: INSTITUTIONAL HEADER & METADATA BANNER
  // =========================================================================

  // Top accent bar
  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(0, 0, 297, 3.5, 'F');

  // Left Title Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...COLOR_NAVY);
  doc.text('PALAWAN STATE UNIVERSITY', 14, 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_ORANGE);
  doc.text('SportsTrack — Institutional Athletic Performance & Compliance Dossier (FR-43)', 14, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_SLATE_MUTED);
  doc.text('Official Athletic Performance, Medal Tally & Participation Dossier • Strict 9 Ballgame Disciplines Scope', 14, 21.5);

  // Right Metadata Card (bounded with maxWidth protection)
  doc.setFillColor(...COLOR_BG_ALT);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(175, 6, 108, 19, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_NAVY);
  doc.text('AUDITED OFFICER:', 178, 10.5);
  doc.text('ACADEMIC PERIOD:', 178, 14.5);
  doc.text('DISCIPLINE SCOPE:', 178, 18.5);
  doc.text('GENERATION TIME:', 178, 22.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_SLATE_DARK);
  doc.text(adminName, 206, 10.5, { maxWidth: 74 });
  doc.text(reportData.metadata.academicYear, 206, 14.5, { maxWidth: 74 });
  doc.text(`${reportData.metadata.sportFilter} • ${reportData.metadata.divisionFilter}`, 206, 18.5, { maxWidth: 74 });
  doc.text(reportData.metadata.generatedAt, 206, 22.5, { maxWidth: 74 });

  // Horizontal divider rule
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.25);
  doc.line(14, 27, 283, 27);

  let currentY = 32;

  const hasAnySection = showWinningColleges || showStandings || showMvpRecords || showParticipation;
  if (!hasAnySection) {
    currentY = renderSectionHeader(
      doc,
      currentY,
      'Institutional Dossier Notice',
      'No report modules were selected for export.',
      'Export Scope Notice'
    );
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_SLATE_MUTED);
    doc.text(
      'All report modules have been toggled off in the report configuration deck. Enable Winning Colleges, Standings, MVP Records, or Event Participation in the Admin Reports toolbar to include data tables in this document.',
      14,
      currentY + 6
    );
  }

  // =========================================================================
  // SECTION 1: Winning College per Sport per Year
  // =========================================================================
  if (showWinningColleges) {
    currentY = renderSectionHeader(
      doc,
      currentY,
      '1. Winning College per Sport per Year',
      'Official crowned champions, runner-ups, and podium finishers from completed tournament finals.',
      `${reportData.winningColleges.length} Crowned Champions`
    );

    const winningHeaders = [
      'Year',
      'Sport Discipline',
      'Tournament Event',
      'Gold / Champion College',
      'Silver / Runner-Up',
      'Bronze / 3rd Place',
      'Finals Score',
    ];

    const winningRows = reportData.winningColleges.length > 0
      ? reportData.winningColleges.map((w) => [
          w.academicYear,
          w.sport,
          `${w.tournamentName}\n(${w.division})`,
          `[${w.championCollegeCode}] ${w.championCollege}\n${w.championTeamName}`,
          `[${w.runnerUpCollegeCode}] ${w.runnerUpCollege}\n${w.runnerUpTeamName}`,
          w.bronzeCollegeCode && w.bronzeCollegeCode !== '—' && w.bronzeCollegeCode !== 'N/A' && w.bronzeCollege !== 'N/A'
            ? `[${w.bronzeCollegeCode}] ${w.bronzeCollege}\n${w.bronzeTeamName}`
            : 'Not contested',
          w.finalsScore,
        ])
      : [[{
          content: 'No completed championship tournaments found in this scope.',
          colSpan: 7,
          styles: { halign: 'center' as const, textColor: COLOR_SLATE_MUTED, fontStyle: 'italic' as const },
        }]];

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [winningHeaders],
      body: winningRows,
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' },
        1: { cellWidth: 30, fontStyle: 'bold' },
        2: { cellWidth: 52 },
        3: { cellWidth: 52, fontStyle: 'bold' },
        4: { cellWidth: 50 },
        5: { cellWidth: 45 },
        6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 9;
  }

  // =========================================================================
  // SECTION 2A: Squad & College Match Standings
  // =========================================================================
  if (showStandings) {
    currentY = renderSectionHeader(
      doc,
      currentY,
      '2A. Squad & College Match Standings',
      'Official squad rankings, win rates, and point differentials across official tournament matches.',
      `${reportData.teamStandings.length} Squads Ranked`
    );

    const teamHeaders = [
      'Rank',
      'Squad Name',
      'College',
      'Discipline',
      'GP',
      'W',
      'L',
      'Win %',
      'PF',
      'PA',
      'Diff',
    ];

    const teamRows = reportData.teamStandings.length > 0
      ? reportData.teamStandings.map((t) => [
          `#${t.rank}`,
          t.teamName,
          `[${t.collegeCode}] ${t.collegeName}`,
          t.sport,
          String(t.matchesPlayed),
          String(t.wins),
          String(t.losses),
          `${t.winRate}%`,
          String(t.pointsFor),
          String(t.pointsAgainst),
          t.pointDiff >= 0 ? `+${t.pointDiff}` : String(t.pointDiff),
        ])
      : [[{
          content: 'No team match records found in this scope.',
          colSpan: 11,
          styles: { halign: 'center' as const, textColor: COLOR_SLATE_MUTED, fontStyle: 'italic' as const },
        }]];

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [teamHeaders],
      body: teamRows,
      columnStyles: {
        0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 44, fontStyle: 'bold' },
        2: { cellWidth: 56 },
        3: { cellWidth: 28 },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 15, halign: 'center', textColor: [16, 185, 129] },
        6: { cellWidth: 15, halign: 'center', textColor: [244, 63, 94] },
        7: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        8: { cellWidth: 18, halign: 'center' },
        9: { cellWidth: 18, halign: 'center' },
        10: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 9;

    // =======================================================================
    // SECTION 2B: Top Individual Athlete Scorers
    // =======================================================================
    currentY = renderSectionHeader(
      doc,
      currentY,
      '2B. Top Individual Athlete Scorers & Performance',
      'Individual scoring performance, points per game, and match distinction honours.',
      `${reportData.athleteStandings.length} Athletes Ranked`
    );

    const athleteHeaders = [
      'Rank',
      'Athlete Name',
      'College',
      'Discipline',
      'Squad',
      'GP',
      'Total Pts',
      'PPG',
      'MVPs',
    ];

    const athleteRows = reportData.athleteStandings.length > 0
      ? reportData.athleteStandings.map((a) => [
          `#${a.rank}`,
          a.playerName,
          `[${a.collegeCode}] ${a.collegeName}`,
          a.sport,
          a.teamName,
          String(a.gamesPlayed),
          String(a.totalPoints),
          String(a.ppg),
          String(a.mvpCount),
        ])
      : [[{
          content: 'No athlete individual scoring data logged for this scope.',
          colSpan: 9,
          styles: { halign: 'center' as const, textColor: COLOR_SLATE_MUTED, fontStyle: 'italic' as const },
        }]];

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [athleteHeaders],
      body: athleteRows,
      columnStyles: {
        0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 45, fontStyle: 'bold' },
        2: { cellWidth: 56 },
        3: { cellWidth: 28 },
        4: { cellWidth: 42 },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 22, halign: 'center', fontStyle: 'bold', textColor: COLOR_ORANGE },
        7: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        8: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [217, 119, 6] },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 9;
  }

  // =========================================================================
  // SECTION 3: Gold Star & Red Star MVP Award Records
  // =========================================================================
  if (showMvpRecords) {
    currentY = renderSectionHeader(
      doc,
      currentY,
      '3. Gold Star and Red Star MVP Award Records',
      'Official individual distinction records: Gold Star (Tournament MVP) and Red Star (Match MVP).',
      `${reportData.mvpAwards.length} Stars Awarded`
    );

    const mvpHeaders = [
      'Award Distinction',
      'Athlete Honoree',
      'College',
      'Discipline',
      'Event Context',
      'Award Date',
    ];

    // Note: Do not use unicode star character (U+2605) as standard Helvetica WinAnsiEncoding corrupts it to '&'
    const mvpRows = reportData.mvpAwards.length > 0
      ? reportData.mvpAwards.map((m) => [
          m.starType === 'Gold' ? 'Gold Star (Tournament MVP)' : 'Red Star (Match MVP)',
          m.athleteName,
          `[${m.collegeCode}] ${m.collegeName}`,
          m.sport,
          m.matchContext ? `${m.tournamentName}\n${m.matchContext}` : m.tournamentName,
          m.awardedDate,
        ])
      : [[{
          content: 'No MVP star awards logged for this scope.',
          colSpan: 6,
          styles: { halign: 'center' as const, textColor: COLOR_SLATE_MUTED, fontStyle: 'italic' as const },
        }]];

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [mvpHeaders],
      body: mvpRows,
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 48, fontStyle: 'bold' },
        2: { cellWidth: 56 },
        3: { cellWidth: 28 },
        4: { cellWidth: 66 },
        5: { cellWidth: 26, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const raw = String(data.cell.raw || '');
          if (raw.includes('Gold Star')) {
            data.cell.styles.textColor = [217, 119, 6];
          } else if (raw.includes('Red Star')) {
            data.cell.styles.textColor = [225, 29, 72];
          }
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 9;
  }

  // =========================================================================
  // SECTION 4: Event Participation Summaries
  // =========================================================================
  if (showParticipation) {
    // 4A: Participation Breakdown by Sport
    currentY = renderSectionHeader(
      doc,
      currentY,
      '4A. Participation Metrics by Official PSU Ballgame Discipline',
      'Athletic participation volumes, squad enrollments, and college distribution across official ballgame disciplines.',
      'Strict 9 Ballgames Scope'
    );

    const sportHeaders = [
      'Ballgame Discipline',
      'Tournaments Hosted',
      'Active Squads',
      'Enrolled Athletes',
      'Colleges Represented',
      'Participating Colleges',
    ];

    const sportRows = reportData.sportParticipation.length > 0
      ? reportData.sportParticipation.map((sp) => [
          sp.sport,
          String(sp.totalTournaments),
          String(sp.totalTeams),
          String(sp.totalAthletes),
          String(sp.collegesRepresented),
          sp.collegeCodes.join(', ') || 'None',
        ])
      : [[{
          content: 'No sport participation data available for this scope.',
          colSpan: 6,
          styles: { halign: 'center' as const, textColor: COLOR_SLATE_MUTED, fontStyle: 'italic' as const },
        }]];

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [sportHeaders],
      body: sportRows,
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 32, halign: 'center', fontStyle: 'bold', textColor: COLOR_ORANGE },
        4: { cellWidth: 37, halign: 'center' },
        5: { cellWidth: 90 },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 9;

    // 4B: Participation & Medal Tally by College
    currentY = renderSectionHeader(
      doc,
      currentY,
      '4B. Institutional College Participation & Medal Overview',
      'University-wide college representation, squad participation, and athletic title achievements.',
      `${reportData.collegeParticipation.length} Colleges Represented`
    );

    const collegeHeaders = [
      'College / Institutional Unit',
      'Disciplines',
      'Squads',
      'Athletes',
      'Gold / Titles',
      'Silver / 2nd',
      'Gold Stars',
      'Red Stars',
    ];

    const collegeRows = reportData.collegeParticipation.length > 0
      ? reportData.collegeParticipation.map((cp) => [
          `[${cp.collegeCode}] ${cp.collegeName}`,
          String(cp.participatingSports.length),
          String(cp.totalTeams),
          String(cp.totalAthletes),
          String(cp.championships),
          String(cp.runnerUps),
          String(cp.goldStars),
          String(cp.redStars),
        ])
      : [[{
          content: 'No college participation data available for this scope.',
          colSpan: 8,
          styles: { halign: 'center' as const, textColor: COLOR_SLATE_MUTED, fontStyle: 'italic' as const },
        }]];

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [collegeHeaders],
      body: collegeRows,
      columnStyles: {
        0: { cellWidth: 79, fontStyle: 'bold' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 28, halign: 'center', fontStyle: 'bold', textColor: [217, 119, 6] },
        5: { cellWidth: 28, halign: 'center' },
        6: { cellWidth: 28, halign: 'center', fontStyle: 'bold', textColor: [234, 179, 8] },
        7: { cellWidth: 31, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 9;
  }

  // =========================================================================
  // RUNNING FOOTERS & MULTI-PAGE HEADERS
  // =========================================================================
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Multi-page running header (Pages 2+)
    if (i > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_SLATE_MUTED);
      doc.text('PALAWAN STATE UNIVERSITY • PSU SportsTrack Institutional Report (FR-43)', 14, 10);

      doc.setFont('helvetica', 'normal');
      doc.text(
        `Scope: ${reportData.metadata.academicYear} • ${reportData.metadata.sportFilter} • ${reportData.metadata.divisionFilter}`,
        283,
        10,
        { align: 'right', maxWidth: 140 }
      );

      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.2);
      doc.line(14, 12, 283, 12);
    }

    // Running footer on all pages
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.25);
    doc.line(14, 201, 283, 201);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLOR_SLATE_MUTED);
    doc.text(
      'Palawan State University • PSU SportsTrack Official Athletic Record • Verified Administrative Compliance (FR-43)',
      14,
      205
    );

    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${i} of ${totalPages}`, 283, 205, { align: 'right' });
  }

  // Determine standard institutional report filename
  const yearPart = filters.academicYear === 'current' ? '2026' : filters.academicYear;
  const sportPart = filters.sport === 'all' ? 'all-sports' : filters.sport.toLowerCase().replace(/\s+/g, '-');
  const filename = `psu-sportstrack-institutional-report-${yearPart}-${sportPart}.pdf`;

  // Trigger direct vector PDF download
  doc.save(filename);

  return filename;
}
