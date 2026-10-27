export interface LegalSection {
  title: string;
  content: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export const PRIVACY_POLICY: {
  effective: string;
  organization: string;
  contactPerson: string;
  contactEmail: string;
  sections: LegalSection[];
} = {
  effective: 'School Year 2026-2027',
  organization: 'Palawan State University – Sports Department',
  contactPerson: 'Janice G.',
  contactEmail: 'janiceno@psu.palawan.edu.ph',
  sections: [
    {
      title: '1. Introduction',
      content: [
        "This Privacy Policy explains how Palawan State University (PSU) – Sports Department collects, uses, stores, and protects personal information through PSU SportsTrack, the university's web-based platform for managing collegiate sports tournaments, rosters, live scoring, and rankings. It is written in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) of the Philippines. By registering for or using PSU SportsTrack, you acknowledge this policy and consent to the processing of your personal information as described here.",
      ],
    },
    {
      title: '2. Personal Information Controller',
      content: [
        'Organization: Palawan State University – Sports Department',
        'Contact person: Janice G.',
        'Contact email: janiceno@psu.palawan.edu.ph',
      ],
    },
    {
      title: '3. Information We Collect',
      content: [
        'PSU SportsTrack collects specific categories of user information necessary for legitimate collegiate athletic operations:',
      ],
      table: {
        headers: ['Information', 'From whom', 'Purpose', 'Who can see it'],
        rows: [
          [
            'Name, college/department, student number, institutional email',
            'All registered users',
            'Account creation, identity, eligibility, and team assignment',
            'Account owner and Administrator. Name is also shown publicly (see Section 4).',
          ],
          [
            'Login credentials and session data',
            'All registered users',
            'Authentication through Supabase Auth',
            'Not displayed to other users',
          ],
          [
            'Certificate of Registration (COR) and its automated confidence score',
            'Student athletes',
            'Verify enrollment and clear athletes for recruitment',
            'Account owner and Administrator only',
          ],
          [
            'Faculty ID document',
            'Faculty athletes and coaches',
            'Verify faculty or employee status',
            'Account owner and Administrator only',
          ],
          [
            'Roster and lineup data: team, jersey number, position, captain, starter or bench, game-day availability',
            'Athletes (set by coaches)',
            'Roster management and match operations',
            'Name and jersey number are public; coaches see their own team rosters',
          ],
          [
            'Match records: scores, box score statistics, MVP stars, medals',
            'Athletes (recorded by facilitators)',
            'Live scoring, rankings, and tournament results',
            'Public leaderboards and match pages, shown with the athlete\'s name and jersey number',
          ],
          [
            'Audit log entries',
            'Administrators and scorers',
            'Accountability and security of administrative and scoring actions',
            'Administrator only',
          ],
          [
            'Device-stored data: failed-login counter, offline scoring queue, theme preference',
            'All users',
            'Login protection, offline score buffering, display preference',
            'Stored in your own browser only',
          ],
        ],
      },
    },
    {
      title: '4. What the Public Can See',
      content: [
        'Spectators do not need an account to view tournaments, brackets, standings, and live match pages. On these pages, an athlete is identified only by name and jersey number. Student numbers, emails, COR documents, and faculty ID documents are never shown publicly.',
      ],
    },
    {
      title: '5. How We Use Your Information',
      content: [
        'Creating and securing your account and assigning your role.',
        'Verifying athlete eligibility through COR and faculty ID review.',
        'Forming teams, managing rosters, and operating tournaments, brackets, and live matches.',
        'Computing and publishing standings, medals, and MVP recognition.',
        'Keeping an audit trail and protecting the system from abuse, including temporary lockout after repeated failed logins.',
        'Your information is not sold, and it is not used for advertising or marketing.',
      ],
    },
    {
      title: '6. Who Has Access',
      content: [
        'Access is controlled by role and enforced by database Row-Level Security policies:',
        '• Administrator: the only role that can view and review COR and faculty ID documents, and the only role with access to audit logs.',
        '• Coaches: can search verified athletes to recruit them and manage their own team rosters. They cannot view verification documents.',
        '• Facilitators: can record scores and match events only for the match they are assigned to.',
        '• Athletes: can view and manage their own profile and documents.',
        '• The public: read-only access to published tournament and match information (Section 4).',
      ],
    },
    {
      title: '7. Storage, Hosting, and Transfers Outside the Philippines',
      content: [
        'System data is stored in a Supabase-managed PostgreSQL database and file storage hosted in Mumbai, India. The web application is delivered through Vercel. By using PSU SportsTrack, you understand that your personal information is processed and stored on these cloud services, outside the Philippines. Uploaded verification documents are held in a restricted storage bucket that only the account owner and the Administrator can access.',
        'PSU SportsTrack does not use third-party analytics, advertising, or tracking tools.',
      ],
    },
    {
      title: '8. Data Security',
      content: [
        '• Role-based access control and database Row-Level Security on every table.',
        '• Encrypted connections (HTTPS/TLS) between your device and the system.',
        '• Restricted storage for verification documents.',
        '• Account lockout for 5 minutes after 3 failed login attempts.',
        '• Audit logging of administrative and scoring actions.',
        'No system is completely secure. If a personal data breach occurs, PSU will handle and report it as required by RA 10173 and the National Privacy Commission.',
      ],
    },
    {
      title: '9. Data Retention',
      content: [
        "Records are kept in the PSU SportsTrack database to maintain the Sports Department's tournament history, rankings, and audit trail. Records that are removed in the system are soft-deleted and can be restored by the Administrator.",
      ],
    },
    {
      title: '10. Your Rights and Choices',
      content: [
        'The system does not provide users with tools to edit or delete their records themselves, and information stays in the system database as described in Section 9. You may still raise concerns about your personal information, including questions, corrections, or complaints, with the Sports Department contact in Section 2. You also have the right to file a complaint with the National Privacy Commission of the Philippines.',
      ],
    },
    {
      title: '11. Eligibility',
      content: [
        'PSU SportsTrack is intended for users aged 18 and above. It is not intended for minors, and minors may not register.',
      ],
    },
    {
      title: '12. Changes to This Policy',
      content: [
        'PSU may update this policy from time to time. The effective school year is shown at the top of this document, and the current version will be made available through the system.',
      ],
    },
    {
      title: '13. Contact',
      content: [
        'For questions about this policy, contact Janice G., PSU Sports Department, Palawan State University.',
        'Email: janiceno@psu.palawan.edu.ph',
      ],
    },
  ],
};

export const TERMS_AND_CONDITIONS: {
  effective: string;
  organization: string;
  contactPerson: string;
  contactEmail: string;
  sections: LegalSection[];
} = {
  effective: 'School Year 2026-2027',
  organization: 'Palawan State University – Sports Department',
  contactPerson: 'Janice G.',
  contactEmail: 'janiceno@psu.palawan.edu.ph',
  sections: [
    {
      title: '1. Acceptance of Terms',
      content: [
        'By registering for, accessing, or using PSU SportsTrack ("the System"), you agree to these Terms and Conditions and to the Privacy Policy. If you do not agree, do not register or use the System. Spectators who only view public pages are also covered by these Terms.',
      ],
    },
    {
      title: '2. About the System',
      content: [
        'PSU SportsTrack is a web-based platform operated by the Palawan State University (PSU) – Sports Department. It manages collegiate sports tournaments, team rosters, athlete verification, live match scoring, and rankings for PSU sports events.',
      ],
    },
    {
      title: '3. Eligibility',
      content: [
        '• Registration is for users aged 18 and above. Minors may not register.',
        '• Student athletes must be currently enrolled PSU students.',
        '• Faculty athletes and coaches must be PSU faculty or personnel.',
        '• Spectators do not need an account to view public pages.',
      ],
    },
    {
      title: '4. User Accounts and Roles',
      content: [
        '• The System has these user types: Spectator, Student Athlete, Faculty Athlete, Coach, Court-Side Facilitator, and Administrator. Each has its own permissions.',
        '• You must provide accurate, complete, and current information when registering, including your real name, college, and student number, and your institutional PSU email.',
        '• You are responsible for keeping your password confidential and for all activity under your account. Report suspected unauthorized access to the Sports Department.',
        '• Accounts are for one person only. Do not share, sell, or transfer your account.',
        '• The System temporarily locks an account for 5 minutes after 3 failed login attempts.',
        '• The Administrator assigns and revokes Facilitator status and can suspend or lock accounts that violate these Terms.',
      ],
    },
    {
      title: '5. Athlete Verification',
      content: [
        '• Student athletes must upload their Certificate of Registration (COR). Faculty athletes and coaches must upload a valid faculty ID.',
        "• Uploaded documents must be genuine, unaltered, and your own. Submitting false, forged, or another person's documents is a serious violation.",
        "• The System's automated confidence score is only a guide. Only the Administrator can approve or reject a document, and that decision is final within the System.",
        '• Only verified athletes can be recruited to teams.',
        '• Rejected users may be asked to upload a corrected document.',
      ],
    },
    {
      title: '6. Rules for Each Role',
      content: [
        'Athletes: Review and respond to team invitations honestly, and keep your profile information accurate. You may join only one team per sport per tournament.',
        'Coaches: Create teams and manage rosters, jersey numbers, captains, starters, and availability only for your own team. Coaches may not operate the scorekeeper desk, game clock, or scoring controls in any match.',
        'Court-Side Facilitators: You may operate only the matches assigned to you, and only while holding the active scorekeeper lease. Record scores, fouls, timeouts, substitutions, and MVP awards accurately and in good faith. The Administrator may override a lease or correct scores in any match.',
        'Administrators: Use administrative powers (tournaments, verifications, recovery, audit logs) only for official PSU Sports Department purposes.',
      ],
    },
    {
      title: '7. Acceptable Use',
      content: [
        'You agree not to:',
        '• Provide false information or impersonate another person.',
        '• Upload forged, altered, or unlawful documents or content.',
        '• Manipulate scores, statistics, brackets, rosters, or awards, or enter scoring data you are not authorized to enter.',
        "• Attempt to bypass role restrictions, access data you are not permitted to see, or interfere with other users' accounts.",
        '• Attack, overload, scrape, reverse engineer, or otherwise disrupt the System or its servers.',
        '• Use the demo or developer tools, or any test accounts, for purposes other than their official use.',
        '• Harass, defame, or abuse other users, or post harmful or offensive content in any part of the System, including commentary feeds.',
        '• Use the System for any unlawful purpose or in violation of PSU rules.',
      ],
    },
    {
      title: '8. Scores, Results, and Official Records',
      content: [
        '• Scores, statistics, MVP stars, brackets, and rankings are recorded by authorized officials and are displayed in real time.',
        '• Live data may contain errors and may be corrected, including score deductions, rollbacks, and lease overrides. Corrections are recorded in the audit log.',
        "• Final results and awards are determined by the PSU Sports Department. In any dispute, the Department's official records and decisions prevail over what the System displays.",
      ],
    },
    {
      title: '9. Privacy and Personal Information',
      content: [
        'Your personal information is handled under the PSU SportsTrack Privacy Policy and the Data Privacy Act of 2012 (RA 10173). Your name and jersey number are displayed publicly alongside team and match information. You consent to this by registering as an athlete.',
      ],
    },
    {
      title: '10. Audit Logging and Monitoring',
      content: [
        'The System keeps an audit record of administrative and scoring actions. By using the System, you understand that your actions within it may be logged and reviewed for security and accountability.',
      ],
    },
    {
      title: '11. Data Retention and Account Records',
      content: [
        'Records are kept in the System database as described in the Privacy Policy. Users cannot delete their own records. Removed records may be soft-deleted and later restored by the Administrator.',
      ],
    },
    {
      title: '12. Intellectual Property',
      content: [
        '• The System, including its software, design, graphics, and content, belongs to PSU and the Sports Department, and is protected by applicable laws.',
        '• You may not copy, modify, distribute, or create derivative works from the System without written permission from the PSU Sports Department.',
        '• By uploading documents or content, you grant PSU a limited right to store and process them solely to operate the System.',
      ],
    },
    {
      title: '13. Availability and Disclaimers',
      content: [
        '• The System depends on internet connectivity and third-party cloud services (Supabase and Vercel). It is provided "as is" and "as available."',
        '• The Sports Department does not guarantee uninterrupted or error-free operation. Features may be changed, suspended, or withdrawn at any time.',
        '• The System includes an offline scoring queue for network interruptions, but synchronization is not guaranteed in every situation.',
        '• The Sports Department is not responsible for losses resulting from network failures, device problems, user error, unauthorized account access caused by your negligence, or third-party service outages.',
      ],
    },
    {
      title: '14. Limitation of Liability',
      content: [
        'To the extent allowed by law, PSU, the Sports Department, and the System\'s developers are not liable for indirect, incidental, or consequential damages arising from your use of the System. This does not limit any liability that cannot be excluded under Philippine law.',
      ],
    },
    {
      title: '15. Suspension and Termination',
      content: [
        'The Sports Department may suspend, restrict, or terminate access without prior notice if you violate these Terms, submit false information, or threaten the security or fairness of the System. Violations may also be referred to PSU\'s disciplinary processes.',
      ],
    },
    {
      title: '16. Changes to These Terms',
      content: [
        'PSU may update these Terms from time to time. The effective school year is shown at the top. Continued use of the System after changes means you accept them.',
      ],
    },
    {
      title: '17. Governing Law',
      content: [
        'These Terms are governed by the laws of the Republic of the Philippines.',
      ],
    },
    {
      title: '18. Contact',
      content: [
        'For questions about these Terms, contact Janice G., PSU Sports Department, Palawan State University.',
        'Email: janiceno@psu.palawan.edu.ph',
      ],
    },
  ],
};
