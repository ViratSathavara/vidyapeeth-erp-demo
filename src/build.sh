#!/bin/bash
cd "$(dirname "$0")"
{
echo '<title>NPCTE ERP</title>'
echo '<style>'; cat style.css npcte.css; echo '</style>'
echo '<div id="root"></div><div id="layer"></div><div id="dlg"></div>'
echo '<script>'; cat p1_core.js p1b_notify.js p2a_ui.js p2_shell.js p3_students.js p4_fees.js p4a_pdf.js p4b_mail_tail.js p6_admin.js p6b_student.js p7_pwa.js p8_dashboard.js p6d_notify.js; echo '</script>'
} > demo.html
