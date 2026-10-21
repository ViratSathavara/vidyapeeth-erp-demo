#!/bin/bash
cd "$(dirname "$0")"
{
echo '<title>Vidyapeeth ERP Demo</title>'
echo '<meta name="claude:viewport-fit-sides" content="cover">'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
echo '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">'
echo '<style>'; cat style.css; echo '</style>'
echo '<div id="root"></div><div id="layer"></div><div id="dlg"></div>'
echo '<script>'; cat p1_core.js p1b_notify.js p2_shell.js p3_students.js p4_fees.js p4b_mail.js p5_academics.js p6_admin.js p6b_student.js p6c_eventlog.js p6d_notify.js p7_parent_boot.js; echo '</script>'
} > demo.html
