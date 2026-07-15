/**
 * UI Translation Strings
 * 
 * Comprehensive translations for common UI elements across the platform
 */

import type { SupportedLanguage } from './translations';

export interface UITranslations {
  // Navigation
  nav_home: string;
  nav_dashboard: string;
  nav_patients: string;
  nav_appointments: string;
  nav_lab: string;
  nav_pharmacy: string;
  nav_reports: string;
  nav_settings: string;
  nav_logout: string;
  
  // Common Actions
  action_save: string;
  action_cancel: string;
  action_delete: string;
  action_edit: string;
  action_create: string;
  action_search: string;
  action_filter: string;
  action_export: string;
  action_print: string;
  action_submit: string;
  action_back: string;
  action_next: string;
  action_previous: string;
  
  // Forms
  form_required: string;
  form_optional: string;
  form_email: string;
  form_password: string;
  form_confirm_password: string;
  form_first_name: string;
  form_last_name: string;
  form_phone: string;
  form_address: string;
  form_date_of_birth: string;
  form_gender: string;
  
  // Status Messages
  status_loading: string;
  status_success: string;
  status_error: string;
  status_warning: string;
  status_info: string;
  status_no_results: string;
  
  // Patient Portal
  patient_portal_title: string;
  patient_portal_welcome: string;
  patient_portal_appointments: string;
  patient_portal_records: string;
  patient_portal_prescriptions: string;
  patient_portal_labs: string;
  
  // Medical Portal
  medical_portal_title: string;
  medical_portal_patients: string;
  medical_portal_consultations: string;
  medical_portal_vitals: string;
  medical_portal_prescriptions: string;
  medical_portal_discharge: string;
  
  // Lab Portal
  lab_portal_title: string;
  lab_portal_samples: string;
  lab_portal_results: string;
  lab_portal_queue: string;
  lab_portal_reports: string;
  
  // Pharmacy Portal
  pharmacy_portal_title: string;
  pharmacy_portal_inventory: string;
  pharmacy_portal_dispensing: string;
  pharmacy_portal_orders: string;
  pharmacy_portal_alerts: string;
  
  // Admin Portal
  admin_portal_title: string;
  admin_portal_facilities: string;
  admin_portal_staff: string;
  admin_portal_billing: string;
  admin_portal_reports: string;
  admin_portal_settings: string;
  
  // Reception Portal
  reception_portal_title: string;
  reception_portal_checkin: string;
  reception_portal_queue: string;
  reception_portal_appointments: string;
  reception_portal_triage: string;
  
  // Common Labels
  label_name: string;
  label_id: string;
  label_date: string;
  label_time: string;
  label_status: string;
  label_priority: string;
  label_type: string;
  label_category: string;
  label_description: string;
  label_notes: string;
  
  // Time
  time_today: string;
  time_yesterday: string;
  time_this_week: string;
  time_this_month: string;
  time_this_year: string;
  
  // Numbers
  num_one: string;
  num_two: string;
  num_three: string;
  num_four: string;
  num_five: string;
  num_ten: string;
  num_hundred: string;
  num_thousand: string;

  // Language Settings
  choose_language: string;
  app_language: string;
  app_language_description: string;
  patient_language: string;
  patient_language_description: string;
  voice_language: string;
  voice_language_description: string;
  summary: string;
  app: string;
  patient: string;
  voice: string;
  patient_language_note: string;
}

export const UI_TRANSLATIONS: Record<string, UITranslations> = {
  en: {
    // Navigation
    nav_home: 'Home',
    nav_dashboard: 'Dashboard',
    nav_patients: 'Patients',
    nav_appointments: 'Appointments',
    nav_lab: 'Laboratory',
    nav_pharmacy: 'Pharmacy',
    nav_reports: 'Reports',
    nav_settings: 'Settings',
    nav_logout: 'Logout',
    
    // Common Actions
    action_save: 'Save',
    action_cancel: 'Cancel',
    action_delete: 'Delete',
    action_edit: 'Edit',
    action_create: 'Create',
    action_search: 'Search',
    action_filter: 'Filter',
    action_export: 'Export',
    action_print: 'Print',
    action_submit: 'Submit',
    action_back: 'Back',
    action_next: 'Next',
    action_previous: 'Previous',
    
    // Forms
    form_required: 'Required',
    form_optional: 'Optional',
    form_email: 'Email',
    form_password: 'Password',
    form_confirm_password: 'Confirm Password',
    form_first_name: 'First Name',
    form_last_name: 'Last Name',
    form_phone: 'Phone',
    form_address: 'Address',
    form_date_of_birth: 'Date of Birth',
    form_gender: 'Gender',
    
    // Status Messages
    status_loading: 'Loading...',
    status_success: 'Success',
    status_error: 'Error',
    status_warning: 'Warning',
    status_info: 'Information',
    status_no_results: 'No results found',
    
    // Patient Portal
    patient_portal_title: 'Patient Portal',
    patient_portal_welcome: 'Welcome back',
    patient_portal_appointments: 'My Appointments',
    patient_portal_records: 'Medical Records',
    patient_portal_prescriptions: 'My Prescriptions',
    patient_portal_labs: 'Lab Results',
    
    // Medical Portal
    medical_portal_title: 'Medical Portal',
    medical_portal_patients: 'Patients',
    medical_portal_consultations: 'Consultations',
    medical_portal_vitals: 'Vitals',
    medical_portal_prescriptions: 'Prescriptions',
    medical_portal_discharge: 'Discharge Planning',
    
    // Lab Portal
    lab_portal_title: 'Laboratory Portal',
    lab_portal_samples: 'Samples',
    lab_portal_results: 'Results',
    lab_portal_queue: 'Queue',
    lab_portal_reports: 'Reports',
    
    // Pharmacy Portal
    pharmacy_portal_title: 'Pharmacy Portal',
    pharmacy_portal_inventory: 'Inventory',
    pharmacy_portal_dispensing: 'Dispensing',
    pharmacy_portal_orders: 'Orders',
    pharmacy_portal_alerts: 'Alerts',
    
    // Admin Portal
    admin_portal_title: 'Admin Portal',
    admin_portal_facilities: 'Facilities',
    admin_portal_staff: 'Staff',
    admin_portal_billing: 'Billing',
    admin_portal_reports: 'Reports',
    admin_portal_settings: 'Settings',
    
    // Reception Portal
    reception_portal_title: 'Reception Portal',
    reception_portal_checkin: 'Check-in',
    reception_portal_queue: 'Queue',
    reception_portal_appointments: 'Appointments',
    reception_portal_triage: 'Triage',
    
    // Common Labels
    label_name: 'Name',
    label_id: 'ID',
    label_date: 'Date',
    label_time: 'Time',
    label_status: 'Status',
    label_priority: 'Priority',
    label_type: 'Type',
    label_category: 'Category',
    label_description: 'Description',
    label_notes: 'Notes',
    
    // Time
    time_today: 'Today',
    time_yesterday: 'Yesterday',
    time_this_week: 'This Week',
    time_this_month: 'This Month',
    time_this_year: 'This Year',
    
    // Numbers
    num_one: 'One',
    num_two: 'Two',
    num_three: 'Three',
    num_four: 'Four',
    num_five: 'Five',
    num_ten: 'Ten',
    num_hundred: 'Hundred',
    num_thousand: 'Thousand',

    // Language Settings
    choose_language: 'Choose the language to use in the app and when serving patients',
    app_language: 'App Language',
    app_language_description: 'This is the language you will see for buttons, menus, and program elements',
    patient_language: 'Patient Communication Language',
    patient_language_description: 'Language to use when speaking with patients, on WhatsApp, and on phone',
    voice_language: 'TTS Voice Language',
    voice_language_description: 'Voice language to use for automations - WhatsApp audio, voice notes, etc.',
    summary: 'Summary',
    app: 'App',
    patient: 'Patient',
    voice: 'Voice',
    patient_language_note: 'Patient language will be used automatically in messages and calls sent to patients. Patients can choose their language during registration.',
  },
  
  sw: {
    // Navigation
    nav_home: 'Nyumbani',
    nav_dashboard: 'Dashibodi',
    nav_patients: 'Wagonjwa',
    nav_appointments: 'Miadi',
    nav_lab: 'Maabara',
    nav_pharmacy: 'Famasia',
    nav_reports: 'Ripoti',
    nav_settings: 'Mipangilio',
    nav_logout: 'Ondoka',
    
    // Common Actions
    action_save: 'Hifadhi',
    action_cancel: 'Ghairi',
    action_delete: 'Futa',
    action_edit: 'Hariri',
    action_create: 'Unda',
    action_search: 'Tafuta',
    action_filter: 'Chuja',
    action_export: 'Toa',
    action_print: 'Chapa',
    action_submit: 'Wasilisha',
    action_back: 'Rudi',
    action_next: 'Endelea',
    action_previous: 'Kabla',
    
    // Forms
    form_required: 'Inahitajika',
    form_optional: 'Hiari',
    form_email: 'Barua pepe',
    form_password: 'Nenosiri',
    form_confirm_password: 'Thibitisha Nenosiri',
    form_first_name: 'Jina la kwanza',
    form_last_name: 'Jina la mwisho',
    form_phone: 'Simu',
    form_address: 'Anwani',
    form_date_of_birth: 'Tarehe ya kuzaliwa',
    form_gender: 'Jinsia',
    
    // Status Messages
    status_loading: 'Inapakia...',
    status_success: 'Imefanikiwa',
    status_error: 'Kosa',
    status_warning: 'Onyo',
    status_info: 'Maelezo',
    status_no_results: 'Hakuna matokeo yaliyopatikana',
    
    // Patient Portal
    patient_portal_title: 'Portal ya Wagonjwa',
    patient_portal_welcome: 'Karibu tena',
    patient_portal_appointments: 'Miadi Yangu',
    patient_portal_records: 'Rekodi za Matibabu',
    patient_portal_prescriptions: 'Dawa Zangu',
    patient_portal_labs: 'Matokeo ya Maabara',
    
    // Medical Portal
    medical_portal_title: 'Portal ya Matibabu',
    medical_portal_patients: 'Wagonjwa',
    medical_portal_consultations: 'Ushauri',
    medical_portal_vitals: 'Vitals',
    medical_portal_prescriptions: 'Dawa',
    medical_portal_discharge: 'Mpango wa Kuachwa',
    
    // Lab Portal
    lab_portal_title: 'Portal ya Maabara',
    lab_portal_samples: 'Sampuli',
    lab_portal_results: 'Matokeo',
    lab_portal_queue: 'Foleni',
    lab_portal_reports: 'Ripoti',
    
    // Pharmacy Portal
    pharmacy_portal_title: 'Portal ya Famasia',
    pharmacy_portal_inventory: 'Hifadhi',
    pharmacy_portal_dispensing: 'Kutoa dawa',
    pharmacy_portal_orders: 'Oda',
    pharmacy_portal_alerts: 'Onyo',
    
    // Admin Portal
    admin_portal_title: 'Portal ya Utawala',
    admin_portal_facilities: 'Vituo',
    admin_portal_staff: 'Wafanyakazi',
    admin_portal_billing: 'Bili',
    admin_portal_reports: 'Ripoti',
    admin_portal_settings: 'Mipangilio',
    
    // Reception Portal
    reception_portal_title: 'Portal ya Upokeaji',
    reception_portal_checkin: 'Kuingia',
    reception_portal_queue: 'Foleni',
    reception_portal_appointments: 'Miadi',
    reception_portal_triage: 'Uchambuzi wa awali',
    
    // Common Labels
    label_name: 'Jina',
    label_id: 'ID',
    label_date: 'Tarehe',
    label_time: 'Saa',
    label_status: 'Hali',
    label_priority: 'Kipaumbele',
    label_type: 'Aina',
    label_category: 'Kundi',
    label_description: 'Maelezo',
    label_notes: 'Vidokezo',
    
    // Time
    time_today: 'Leo',
    time_yesterday: 'Jana',
    time_this_week: 'Wiki hii',
    time_this_month: 'Mwezi huu',
    time_this_year: 'Mwaka huu',
    
    // Numbers
    num_one: 'Moja',
    num_two: 'Mbili',
    num_three: 'Tatu',
    num_four: 'Nne',
    num_five: 'Tano',
    num_ten: 'Kumi',
    num_hundred: 'Mia',
    num_thousand: 'Elfu',

    // Language Settings
    choose_language: 'Chagua lugha ya kutumia katika app na wakuhudumia wagonjwa',
    app_language: 'Lugha ya App',
    app_language_description: 'Hii ndio lugha utayokumbana na buttons, menus, na viweka vya programu',
    patient_language: 'Lugha ya Kuongea na Mgonjwa',
    patient_language_description: 'Lugha utakayotumia ukizungumza na wagonjwa, katika WhatsApp, na kwa simu',
    voice_language: 'Sauti ya TTS',
    voice_language_description: 'Lugha ya sauti itakayotumika kwa automations - WhatsApp audio, voice notes, n.k.',
    summary: 'Muhtasari',
    app: 'App',
    patient: 'Mgonjwa',
    voice: 'Sauti',
    patient_language_note: 'Lugha ya mgonjwa itatumika kiotomatiki katika maandishi na simu zinazotumwa kwa mgonjwa. Magonjwa wanaweza kuchagua lugha yao wakati wa kusajili.',
  },
  
  am: {
    // Navigation
    nav_home: 'ቤት',
    nav_dashboard: 'ዳሽቦርድ',
    nav_patients: 'ታካሚዎች',
    nav_appointments: 'ቀጠሮዎች',
    nav_lab: 'ላብራቶሪ',
    nav_pharmacy: 'ፋርማሲ',
    nav_reports: 'ሪፖርት',
    nav_settings: 'ቅንብቶች',
    nav_logout: 'ውጣ',
    
    // Common Actions
    action_save: 'አስቀጣጥል',
    action_cancel: 'ተሰርዝ',
    action_delete: 'አጥፋ',
    action_edit: 'አርትድ',
    action_create: 'ፍጠር',
    action_search: 'ፈልግ',
    action_filter: 'ማጣለግ',
    action_export: 'ወጥቅ',
    action_print: 'አትም',
    action_submit: 'አስገብ',
    action_back: 'ተመለስ',
    action_next: 'ቀጣል',
    action_previous: 'ቀድሞ',
    
    // Forms
    form_required: 'ያስፈልጋል',
    form_optional: 'ማስተማር',
    form_email: 'ኢሜይል',
    form_password: 'የይለፍ ቃል',
    form_confirm_password: 'የይለፍ ቃል ያረጋግጡ',
    form_first_name: 'የመጀመሪያ ስም',
    form_last_name: 'የአባት ስም',
    form_phone: 'ስልክ',
    form_address: 'አድራሻ',
    form_date_of_birth: 'የልደት ቀን',
    form_gender: 'ፆታስ',
    
    // Status Messages
    status_loading: 'በመጫን ላይ...',
    status_success: 'ተሳካለ',
    status_error: 'ስህተት',
    status_warning: 'ማስጠንቀቂያ',
    status_info: 'መረጃ',
    status_no_results: 'ምንጣፍ የለም',
    
    // Patient Portal
    patient_portal_title: 'የታካሚ ፖርታል',
    patient_portal_welcome: 'እንኳን እንመነሳችሃለሁ',
    patient_portal_appointments: 'ቀጠሮዬ',
    patient_portal_records: 'የህይም ሪኮርድ',
    patient_portal_prescriptions: 'መድሃኒቶቼ',
    patient_portal_labs: 'የላብራቶሪ ውጤያች',
    
    // Medical Portal
    medical_portal_title: 'የህይም ፖርታል',
    medical_portal_patients: 'ታካሚዎች',
    medical_portal_consultations: 'አማክትዎች',
    medical_portal_vitals: 'ቮማሎጂዎች',
    medical_portal_prescriptions: 'መድሃኒቶች',
    medical_portal_discharge: 'የመልቀት እቅድ',
    
    // Lab Portal
    lab_portal_title: 'የላብራቶሪ ፖርታል',
    lab_portal_samples: 'ናሙሶች',
    lab_portal_results: 'ውጤያች',
    lab_portal_queue: 'ሰርዝ',
    lab_portal_reports: 'ሪፖርቶች',
    
    // Pharmacy Portal
    pharmacy_portal_title: 'የፋርማሲ ፖርታል',
    pharmacy_portal_inventory: 'እቅድ',
    pharmacy_portal_dispensing: 'መስጫ',
    pharmacy_portal_orders: 'ትዕዛዛቶች',
    pharmacy_portal_alerts: 'ማስጠንቀቂያዎች',
    
    // Admin Portal
    admin_portal_title: 'የአስተዳደር ፖርታል',
    admin_portal_facilities: 'ተቋማኖች',
    admin_portal_staff: 'ሰራተኞች',
    admin_portal_billing: 'ክፍያ',
    admin_portal_reports: 'ሪፖርቶች',
    admin_portal_settings: 'ቅንብቶች',
    
    // Reception Portal
    reception_portal_title: 'የተቀበል ፖርታል',
    reception_portal_checkin: 'መግባት',
    reception_portal_queue: 'ሰርዝ',
    reception_portal_appointments: 'ቀጠሮዎች',
    reception_portal_triage: 'መጀመሪያ መረጋጃ',
    
    // Common Labels
    label_name: 'ስም',
    label_id: 'ID',
    label_date: 'ቀን',
    label_time: 'ሰዓት',
    label_status: 'ሁኔታ',
    label_priority: 'ቅድረትነት',
    label_type: 'ዓይን',
    label_category: 'ምድብ',
    label_description: 'መግለጫ',
    label_notes: 'ማስታወሻዎች',
    
    // Time
    time_today: 'ዛሬ',
    time_yesterday: 'ትናወስ',
    time_this_week: 'ዛዕ ሳምንት',
    time_this_month: 'ዛዕ ወርሕ',
    time_this_year: 'ዛዕ አመት',
    
    // Numbers
    num_one: 'አንድ',
    num_two: 'ሁለት',
    num_three: 'ሶስት',
    num_four: 'አርብዕት',
    num_five: 'አምስት',
    num_ten: 'አስር',
    num_hundred: 'መቶ',
    num_thousand: 'ሺልስት',

    // Language Settings
    choose_language: 'ቋንጎ ይምረጡ በመተግበሪያ እና በታካሚዎችን ለመርዝ',
    app_language: 'የመተግበሪያ ቋንጎ',
    app_language_description: 'ይህ ቋንጎ ነው የሚያዩት ለቁጣሮች፣ ምናሮች፣ እና የፕሮግራም አካላዎች',
    patient_language: 'ቋንጎ ለመናገር በታካሚዎች',
    patient_language_description: 'ቋንጎ የሚጠቀሙት በታካሚዎች ጋር፣ በWhatsApp፣ እና በስልክ',
    voice_language: 'የድምጽ ቋንጎ',
    voice_language_description: 'የድምጽ ቋንጎ የሚጠቀሙት ለአውቶሜሽን - WhatsApp ድምጽ፣ የድምጽ ማስታወሻዎች፣ ወዘተ',
    summary: 'ማጠቃለሪያ',
    app: 'መተግበሪያ',
    patient: 'ታካሚ',
    voice: 'ድምጽ',
    patient_language_note: 'የታካሚ ቋንጎ በራስ ይጠቀማል በመልዕት እና በጥሪ የሚላኩት ለታካሚዎች። ታካሚዎች ቋንጎዎን በመመዝገብ ጊዜ ሊምረጡ ይችላሉ።',
  },
  
  yo: {
    // Navigation
    nav_home: 'Ilé',
    nav_dashboard: 'Dàbàà',
    nav_patients: 'Alàìsàn',
    nav_appointments: 'Ipinnu',
    nav_lab: 'Yàrá ìwádìí',
    nav_pharmacy: 'Fármásì',
    nav_reports: 'Ìròyìn',
    nav_settings: 'Àwọn ètò',
    nav_logout: 'Jáde',
    
    // Common Actions
    action_save: 'Fi',
    action_cancel: 'Fagile',
    action_delete: 'Pa',
    action_edit: 'Ṣe',
    action_create: 'Ṣe',
    action_search: 'Wa',
    action_filter: 'Yọ',
    action_export: 'Gbe',
    action_print: 'Tẹ',
    action_submit: 'Fi',
    action_back: 'Padà',
    action_next: 'Tẹlẹ',
    action_previous: 'Ti',
    
    // Forms
    form_required: 'Gbọdọwọ',
    form_optional: 'Ayanfẹ',
    form_email: 'Imeeli',
    form_password: 'Ọrọ Ẹni',
    form_confirm_password: 'Jẹrisi Ọrọ Ẹni',
    form_first_name: 'Orúkọ Àkọ́kọ́',
    form_last_name: 'Orúkọ Ìyá',
    form_phone: 'Fọ̀nù',
    form_address: 'Ibùgbé',
    form_date_of_birth: 'Ojọ́bí',
    form_gender: 'Ọkùn',
    
    // Status Messages
    status_loading: 'N gba...',
    status_success: 'Aṣeyọri',
    status_error: 'Aṣìṣe',
    status_warning: 'Ikilọ',
    status_info: 'Alaye',
    status_no_results: 'Ko si abajade',
    
    // Patient Portal
    patient_portal_title: 'Pọ́tàl Alàìsàn',
    patient_portal_welcome: 'Kaabo',
    patient_portal_appointments: 'Ipinnu Mi',
    patient_portal_records: 'Ìtàn Ìwòsàn',
    patient_portal_prescriptions: 'Oogun Mi',
    patient_portal_labs: 'Abajade Yàrá ìwádìí',
    
    // Medical Portal
    medical_portal_title: 'Pọ́tàl Oníṣègù',
    medical_portal_patients: 'Alàìsàn',
    medical_portal_consultations: 'Apero',
    medical_portal_vitals: 'Aaye',
    medical_portal_prescriptions: 'Oogun',
    medical_portal_discharge: 'Ìpọ́n Kúrò',
    
    // Lab Portal
    lab_portal_title: 'Pọ́tàl Yàrá ìwádìí',
    lab_portal_samples: 'Àwọn apẹrẹ',
    lab_portal_results: 'Abajade',
    lab_portal_queue: 'Àkójọ',
    lab_portal_reports: 'Ìròyìn',
    
    // Pharmacy Portal
    pharmacy_portal_title: 'Pọ́tàl Fármásì',
    pharmacy_portal_inventory: 'Ibi ipamọ',
    pharmacy_portal_dispensing: 'Síṣe',
    pharmacy_portal_orders: 'Aṣẹ',
    pharmacy_portal_alerts: 'Ikilọ',
    
    // Admin Portal
    admin_portal_title: 'Pọ́tàl Alákọ̀so',
    admin_portal_facilities: 'Àwọn ilé',
    admin_portal_staff: 'Àwọn oṣiṣẹ',
    admin_portal_billing: 'Iṣakó',
    admin_portal_reports: 'Ìròyìn',
    admin_portal_settings: 'Àwọn eto',
    
    // Reception Portal
    reception_portal_title: 'Pọ́tàl Gbàgbé',
    reception_portal_checkin: 'Wọlé',
    reception_portal_queue: 'Àkójọ',
    reception_portal_appointments: 'Ipinnu',
    reception_portal_triage: 'Ayẹwo',
    
    // Common Labels
    label_name: 'Orúkọ',
    label_id: 'ID',
    label_date: 'Ojọ́',
    label_time: 'Aago',
    label_status: 'Ipó',
    label_priority: 'Aiyipada',
    label_type: 'Iru',
    label_category: 'Ẹka',
    label_description: 'Apejuwe',
    label_notes: 'Awọn nọ́ta',
    
    // Time
    time_today: 'Òní',
    time_yesterday: 'Àla',
    time_this_week: 'Ọsẹ̀ yìí',
    time_this_month: 'Oṣù yìí',
    time_this_year: 'Ọdún yìí',
    
    // Numbers
    num_one: 'Kan',
    num_two: 'Mẹ́jì',
    num_three: 'Mẹ́ta',
    num_four: 'Mẹ́rin',
    num_five: 'Mẹ́fa',
    num_ten: 'Mẹ́wà',
    num_hundred: 'Ọgọrun',
    num_thousand: 'Ẹgbẹrun',

    // Language Settings
    choose_language: 'Yàn èdè lati ma n lo ninu app ati lati fi se alaisan',
    app_language: 'Èdè App',
    app_language_description: 'Èdè yìí ni yio ma ri fun awọn bọtínì, àwọn àpẹrẹ, àti awọn ẹ̀ka eto',
    patient_language: 'Èdè Lati Sọ pẹ̀lú Alàìsàn',
    patient_language_description: 'Èdè yio ma lo lati sọ pẹ̀lú alàìsàn, lori WhatsApp, ati lori ẹrọ',
    voice_language: 'Èdè Ohùn TTS',
    voice_language_description: 'Èdè ohùn yio ma lo fun awọn iṣẹ-ṣiṣe - ohùn WhatsApp, àwọn ohùn nọ́ta, ati bẹ́ẹ́kọ́',
    summary: 'Àpọ́jọ',
    app: 'App',
    patient: 'Alàìsàn',
    voice: 'Ohùn',
    patient_language_note: 'Èdè alàìsàn yio ma lo laifọwọ́ ninu àwọn ifiweranṣẹ ati awọn ipe ti a n fi ranṣẹ alàìsàn. Alàìsàn le yan èdè wọn nigbati wọ́n n ṣe iforukọsilẹ.',
  },
  
  zu: {
    // Navigation
    nav_home: 'Ekhaya',
    nav_dashboard: 'I-Dashibodi',
    nav_patients: 'Abagumbi',
    nav_appointments: 'Izikhathi',
    nav_lab: 'Ilabhorethri',
    nav_pharmacy: 'Ipharmacy',
    nav_reports: 'Izingqopho',
    nav_settings: 'Izilungiselelo',
    nav_logout: 'Phuma',
    
    // Common Actions
    action_save: 'Gcina',
    action_cancel: 'Khansela',
    action_delete: 'Cisha',
    action_edit: 'Lungisa',
    action_create: 'Dala',
    action_search: 'Sesha',
    action_filter: 'Hlunga',
    action_export: 'Thumela',
    action_print: 'Shicilela',
    action_submit: 'Nikela',
    action_back: 'Emuva',
    action_next: 'Okulandelayo',
    action_previous: 'Okudlule',
    
    // Forms
    form_required: 'Kudingeka',
    form_optional: 'Okhethwayo',
    form_email: 'I-imeyli',
    form_password: 'Iphasiwedi',
    form_confirm_password: 'Qinisa Iphasiwedi',
    form_first_name: 'Igama lokuqala',
    form_last_name: 'Igama lokugcina',
    form_phone: 'Ucingo',
    form_address: 'Ideresi',
    form_date_of_birth: 'Usuku lokuzalwa',
    form_gender: 'Isibunu',
    
    // Status Messages
    status_loading: 'Ilayisha...',
    status_success: 'Iphumelela',
    status_error: 'Iphutha',
    status_warning: 'Isixwayiso',
    status_info: 'Ulwazi',
    status_no_results: 'Awumphumela awutholakala',
    
    // Patient Portal
    patient_portal_title: 'Iphothali Yabagumbi',
    patient_portal_welcome: 'Wamukelekile',
    patient_portal_appointments: 'Izikhathi Zami',
    patient_portal_records: 'Izingceni Zesipolisi',
    patient_portal_prescriptions: 'Umuthi Wami',
    patient_portal_labs: 'Izingqopho Zelabhorethri',
    
    // Medical Portal
    medical_portal_title: 'Iphothali Yesipolisi',
    medical_portal_patients: 'Abagumbi',
    medical_portal_consultations: 'Ukuxoxisana',
    medical_portal_vitals: 'Izinga',
    medical_portal_prescriptions: 'Umuthi',
    medical_portal_discharge: 'Ukuhambisa',
    
    // Lab Portal
    lab_portal_title: 'Iphothali Yelabhorethri',
    lab_portal_samples: 'Izimpahla',
    lab_portal_results: 'Izingqopho',
    lab_portal_queue: 'Umqondo',
    lab_portal_reports: 'Izingqopho',
    
    // Pharmacy Portal
    pharmacy_portal_title: 'Iphothali Yepharmacy',
    pharmacy_portal_inventory: 'Uhlango',
    pharmacy_portal_dispensing: 'Ukudlula',
    pharmacy_portal_orders: 'Izilungiselelo',
    pharmacy_portal_alerts: 'Izixwayiso',
    
    // Admin Portal
    admin_portal_title: 'Iphothali Yephathi',
    admin_portal_facilities: 'Izindawo',
    admin_portal_staff: 'Abasebenzi',
    admin_portal_billing: 'Ukubhalansela',
    admin_portal_reports: 'Izingqopho',
    admin_portal_settings: 'Izilungiselelo',
    
    // Reception Portal
    reception_portal_title: 'Iphothali Yokuqamukela',
    reception_portal_checkin: 'Ukungena',
    reception_portal_queue: 'Umqondo',
    reception_portal_appointments: 'Izikhathi',
    reception_portal_triage: 'Ukuhlola',
    
    // Common Labels
    label_name: 'Igama',
    label_id: 'ID',
    label_date: 'Usuku',
    label_time: 'Isikhathi',
    label_status: 'Isimo',
    label_priority: 'Ukuqanjwa',
    label_type: 'Uhlobo',
    label_category: 'Isigaba',
    label_description: 'Incazelo',
    label_notes: 'Izinombolo',
    
    // Time
    time_today: 'Namhlanje',
    time_yesterday: 'Izolo',
    time_this_week: 'Kusasa lokuqala',
    time_this_month: 'Kuvesi lokuqala',
    time_this_year: 'Unyaka wokuqala',
    
    // Numbers
    num_one: 'Kunye',
    num_two: 'Kubili',
    num_three: 'Kuthathu',
    num_four: 'Kune',
    num_five: 'Kuhlanu',
    num_ten: 'Kushiya kanye',
    num_hundred: 'Kukhulu',
    num_thousand: 'Kuinkulungwane',

    // Language Settings
    choose_language: 'Khetha ulimi lokusebenza ku-app nase kubasebenza abagumbi',
    app_language: 'Ulwimi lwe-App',
    app_language_description: 'Loku ulimi ozokubona ku-zinkinambatho, amamenyu, kanye nezinsalela zohlelo',
    patient_language: 'Ulwimi Lokuxoxisana Nengqumbi',
    patient_language_description: 'Ulwimi ozokusebenza ukuxoxisana nengqumbi, ku-WhatsApp, nasekumshini',
    voice_language: 'Ulwimi lwe-Voice ye-TTS',
    voice_language_description: 'Ulwimi lwe-voice ozokusetshenziswa ku-automations - i-WhatsApp audio, amavoice notes, njll.',
    summary: 'Isishwankathelo',
    app: 'I-App',
    patient: 'Umgumbi',
    voice: 'I-Voice',
    patient_language_note: 'Ulwimi lwengqumbi luzosebenzwa ngokuzenzekelayo emakhwenkwa nakwizimana ezithunyelwe kubagumbi. Abagumbi bangakhetha ulwimi lwabo bakubhalisa.',
  },
  
  ar: {
    // Navigation
    nav_home: 'الرئيسية',
    nav_dashboard: 'لوحة التحكم',
    nav_patients: 'المرضى',
    nav_appointments: 'المواعيد',
    nav_lab: 'المختبر',
    nav_pharmacy: 'الصيدلية',
    nav_reports: 'التقارير',
    nav_settings: 'الإعدادات',
    nav_logout: 'تسجيل الخروج',
    
    // Common Actions
    action_save: 'حفظ',
    action_cancel: 'إلغاء',
    action_delete: 'حذف',
    action_edit: 'تعديل',
    action_create: 'إنشاء',
    action_search: 'بحث',
    action_filter: 'تصفية',
    action_export: 'تصدير',
    action_print: 'طباعة',
    action_submit: 'إرسال',
    action_back: 'رجوع',
    action_next: 'التالي',
    action_previous: 'السابق',
    
    // Forms
    form_required: 'مطلوب',
    form_optional: 'اختياري',
    form_email: 'البريد الإلكتروني',
    form_password: 'كلمة المرور',
    form_confirm_password: 'تأكيد كلمة المرور',
    form_first_name: 'الاسم الأول',
    form_last_name: 'اسم العائلة',
    form_phone: 'الهاتف',
    form_address: 'العنوان',
    form_date_of_birth: 'تاريخ الميلاد',
    form_gender: 'الجنس',
    
    // Status Messages
    status_loading: 'جاري التحميل...',
    status_success: 'نجح',
    status_error: 'خطأ',
    status_warning: 'تحذير',
    status_info: 'معلومات',
    status_no_results: 'لم يتم العثور على نتائج',
    
    // Patient Portal
    patient_portal_title: 'بوابة المرضى',
    patient_portal_welcome: 'مرحباً بعودتك',
    patient_portal_appointments: 'مواعيدي',
    patient_portal_records: 'السجلات الطبية',
    patient_portal_prescriptions: 'وصفاتي الطبية',
    patient_portal_labs: 'نتائج المختبر',
    
    // Medical Portal
    medical_portal_title: 'بوابة الطبية',
    medical_portal_patients: 'المرضى',
    medical_portal_consultations: 'الاستشارات',
    medical_portal_vitals: 'المؤشرات الحيوية',
    medical_portal_prescriptions: 'الوصفات الطبية',
    medical_portal_discharge: 'تخطيط الخروج',
    
    // Lab Portal
    lab_portal_title: 'بوابة المختبر',
    lab_portal_samples: 'العينات',
    lab_portal_results: 'النتائج',
    lab_portal_queue: 'الصف',
    lab_portal_reports: 'التقارير',
    
    // Pharmacy Portal
    pharmacy_portal_title: 'بوابة الصيدلية',
    pharmacy_portal_inventory: 'المخزون',
    pharmacy_portal_dispensing: 'الصرف',
    pharmacy_portal_orders: 'الطلبات',
    pharmacy_portal_alerts: 'التنبيهات',
    
    // Admin Portal
    admin_portal_title: 'بوابة الإدارة',
    admin_portal_facilities: 'المرافق',
    admin_portal_staff: 'الموظفين',
    admin_portal_billing: 'الفوترة',
    admin_portal_reports: 'التقارير',
    admin_portal_settings: 'الإعدادات',
    
    // Reception Portal
    reception_portal_title: 'بوابة الاستقبال',
    reception_portal_checkin: 'تسجيل الدخول',
    reception_portal_queue: 'الصف',
    reception_portal_appointments: 'المواعيد',
    reception_portal_triage: 'التصنيف الأولي',
    
    // Common Labels
    label_name: 'الاسم',
    label_id: 'المعرف',
    label_date: 'التاريخ',
    label_time: 'الوقت',
    label_status: 'الحالة',
    label_priority: 'الأولوية',
    label_type: 'النوع',
    label_category: 'الفئة',
    label_description: 'الوصف',
    label_notes: 'الملاحظات',
    
    // Time
    time_today: 'اليوم',
    time_yesterday: 'أمس',
    time_this_week: 'هذا الأسبوع',
    time_this_month: 'هذا الشهر',
    time_this_year: 'هذا العام',
    
    // Numbers
    num_one: 'واحد',
    num_two: 'اثنان',
    num_three: 'ثلاثة',
    num_four: 'أربعة',
    num_five: 'خمسة',
    num_ten: 'عشرة',
    num_hundred: 'مائة',
    num_thousand: 'ألف',

    // Language Settings
    choose_language: 'اختر اللغة لاستخدامها في التطبيق عند خدمة المرضى',
    app_language: 'لغة التطبيق',
    app_language_description: 'هذه هي اللغة التي ستراها للأزرار والقوائم وعناصر البرنامج',
    patient_language: 'لغة التواصل مع المريض',
    patient_language_description: 'اللغة التي ستستخدمها عند التحدث مع المرضى، عبر واتساب، وعلى الهاتف',
    voice_language: 'لغة الصوت TTS',
    voice_language_description: 'لغة الصوت التي سيتم استخدامها للأتمتة - صوت واتساب، ملاحظات صوتية، إلخ',
    summary: 'ملخص',
    app: 'التطبيق',
    patient: 'المريض',
    voice: 'الصوت',
    patient_language_note: 'سيتم استخدام لغة المريض تلقائيًا في الرسائل والمكالمات المرسلة للمرضى. يمكن للمرضى اختيار لغتهم عند التسجيل.',
  },
};

/**
 * Get UI translation for a key
 */
export function getUITranslation(key: keyof UITranslations, language: SupportedLanguage = 'en'): string {
  return UI_TRANSLATIONS[language]?.[key] ?? UI_TRANSLATIONS.en[key];
}

/**
 * Get all UI translations for a language
 */
export function getUITranslations(language: SupportedLanguage = 'en'): UITranslations {
  return UI_TRANSLATIONS[language] ?? UI_TRANSLATIONS.en;
}
