# Task: Create All JSON Locale Files Scaffold

## Description

Create complete JSON locale file structure across all 4 languages (EN, ES, FR, RU) and all 6 namespaces (common, auth, course, mentor, admin, notification). All keys must be populated with English values initially, with placeholder translations for ES, FR, RU. Establish key naming conventions and provide translation guidelines for non-English languages.

## Affected Apps/Packages

- `packages/i18n/locales/` (all locale files)
- All consuming apps (web, mobile, admin, instructor)

## Requirements

### File Structure

Create directory tree in `packages/i18n/locales/`:

```
locales/
├── en/
│   ├── common.json (200+ keys)
│   ├── auth.json (50+ keys)
│   ├── course.json (100+ keys)
│   ├── mentor.json (80+ keys)
│   ├── admin.json (120+ keys)
│   └── notification.json (60+ keys)
├── es/
│   └── [same structure]
├── fr/
│   └── [same structure]
└── ru/
    └── [same structure]
```

### Key Naming Convention

Use camelCase with descriptive hierarchy:

- Format: `section.feature.element.type`
- Examples:
  - `button.save` - Button with text "Save"
  - `error.validation.email.invalid` - Email validation error
  - `label.courseTitle` - Label for course title
  - `placeholder.enterEmail` - Placeholder text
  - `message.success.courseUpdated` - Success message
  - `empty.noCourses` - Empty state text

### Content Requirements

- All keys populated with English text (EN)
- ES/FR/RU have placeholder translations (can be English for now, flagged for localization team)
- No hardcoded strings outside these files
- Context comments for ambiguous keys
- Consistent terminology across namespaces

### Translation Guidelines (for localization team)

- Maintain tone and style of English originals
- Gender-neutral where possible (especially for Spanish/French)
- Consider cultural context (avoid idioms that don't translate)
- RTL considerations: avoid building sentences left-to-right only
- Date/time formats per locale
- Currency symbols and amounts

## Acceptance Criteria

- [ ] All 4 language directories created with complete namespace files
- [ ] 500+ total keys across all namespaces
- [ ] All EN values populated with descriptive, professional copy
- [ ] All ES/FR/RU files have placeholder/preliminary translations
- [ ] Key naming convention consistent (camelCase hierarchy)
- [ ] No duplicate keys within same namespace
- [ ] Valid JSON syntax (all files parseable)
- [ ] Common contextual notes added for ambiguous strings
- [ ] File size reasonable (not exceeding 500KB per language)

## Dependencies

- React-i18next setup complete (Task: react-i18next-setup.md)

## Technical Notes

### common.json Structure

Navigation, UI controls, and general-purpose labels.

**packages/i18n/locales/en/common.json:**

```json
{
  "appName": "Mentor",
  "appSubtitle": "Master Cosmetics with Expert Guidance",

  "nav": {
    "home": "Home",
    "courses": "Courses",
    "myLearning": "My Learning",
    "search": "Search",
    "profile": "Profile",
    "settings": "Settings",
    "logout": "Logout",
    "explore": "Explore",
    "browse": "Browse",
    "discover": "Discover"
  },

  "button": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "remove": "Remove",
    "add": "Add",
    "create": "Create",
    "update": "Update",
    "submit": "Submit",
    "next": "Next",
    "previous": "Previous",
    "continue": "Continue",
    "skip": "Skip",
    "confirm": "Confirm",
    "close": "Close",
    "learn": "Learn",
    "enroll": "Enroll",
    "enroll_now": "Enroll Now",
    "view_more": "View More",
    "back": "Back",
    "done": "Done",
    "start": "Start",
    "finish": "Finish",
    "retry": "Retry",
    "try_again": "Try Again"
  },

  "label": {
    "email": "Email",
    "password": "Password",
    "firstName": "First Name",
    "lastName": "Last Name",
    "fullName": "Full Name",
    "username": "Username",
    "phone": "Phone Number",
    "language": "Language",
    "theme": "Theme",
    "currency": "Currency",
    "timezone": "Timezone",
    "search_courses": "Search courses",
    "filter": "Filter",
    "sort": "Sort",
    "category": "Category",
    "level": "Level",
    "duration": "Duration",
    "instructor": "Instructor",
    "rating": "Rating",
    "price": "Price"
  },

  "placeholder": {
    "enterEmail": "Enter your email",
    "enterPassword": "Enter your password",
    "enterName": "Enter your name",
    "search": "Search...",
    "searchCourses": "Search courses by title, category, or instructor",
    "typeMessage": "Type your message..."
  },

  "empty": {
    "noCourses": "No courses available",
    "noResults": "No results found",
    "noNotifications": "No notifications",
    "noData": "No data available",
    "noCourseProgress": "You haven't started any courses yet",
    "noWishlist": "Your wishlist is empty"
  },

  "loading": {
    "loading": "Loading...",
    "loadingCourses": "Loading courses...",
    "loadingProfile": "Loading profile...",
    "processing": "Processing..."
  },

  "error": {
    "generic": "Something went wrong",
    "network": "Network error. Please check your connection.",
    "notFound": "Not found",
    "unauthorized": "You are not authorized to access this",
    "forbidden": "Access denied",
    "serverError": "Server error. Please try again later.",
    "retry": "Retry"
  },

  "success": {
    "saved": "Saved successfully",
    "created": "Created successfully",
    "updated": "Updated successfully",
    "deleted": "Deleted successfully",
    "completed": "Completed"
  },

  "confirmation": {
    "deleteItem": "Are you sure you want to delete this?",
    "confirmAction": "Are you sure you want to continue?",
    "unsavedChanges": "You have unsaved changes. Do you want to leave?"
  },

  "footer": {
    "about": "About",
    "contact": "Contact",
    "privacy": "Privacy Policy",
    "terms": "Terms of Service",
    "copyright": "© 2025 Mentor by Mentor. All rights reserved."
  }
}
```

**packages/i18n/locales/es/common.json:**

```json
{
  "appName": "Mentor",
  "appSubtitle": "Domina la Cosmética con Orientación Experta",

  "nav": {
    "home": "Inicio",
    "courses": "Cursos",
    "myLearning": "Mi Aprendizaje",
    "search": "Buscar",
    "profile": "Perfil",
    "settings": "Configuración",
    "logout": "Cerrar Sesión",
    "explore": "Explorar",
    "browse": "Examinar",
    "discover": "Descubrir"
  },

  "button": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "remove": "Quitar",
    "add": "Añadir",
    "create": "Crear",
    "update": "Actualizar",
    "submit": "Enviar",
    "next": "Siguiente",
    "previous": "Anterior",
    "continue": "Continuar",
    "skip": "Saltar",
    "confirm": "Confirmar",
    "close": "Cerrar",
    "learn": "Aprender",
    "enroll": "Inscribirse",
    "enroll_now": "Inscribirse Ahora",
    "view_more": "Ver Más",
    "back": "Atrás",
    "done": "Hecho",
    "start": "Comenzar",
    "finish": "Terminar",
    "retry": "Reintentar",
    "try_again": "Intentar de Nuevo"
  },

  "label": {
    "email": "Correo Electrónico",
    "password": "Contraseña",
    "firstName": "Nombre",
    "lastName": "Apellido",
    "fullName": "Nombre Completo",
    "username": "Nombre de Usuario",
    "phone": "Número de Teléfono",
    "language": "Idioma",
    "theme": "Tema",
    "currency": "Moneda",
    "timezone": "Zona Horaria",
    "search_courses": "Buscar cursos",
    "filter": "Filtrar",
    "sort": "Ordenar",
    "category": "Categoría",
    "level": "Nivel",
    "duration": "Duración",
    "instructor": "Instructor",
    "rating": "Calificación",
    "price": "Precio"
  },

  "placeholder": {
    "enterEmail": "Ingresa tu correo electrónico",
    "enterPassword": "Ingresa tu contraseña",
    "enterName": "Ingresa tu nombre",
    "search": "Buscar...",
    "searchCourses": "Buscar cursos por título, categoría o instructor",
    "typeMessage": "Escribe tu mensaje..."
  },

  "empty": {
    "noCourses": "No hay cursos disponibles",
    "noResults": "Sin resultados",
    "noNotifications": "Sin notificaciones",
    "noData": "No hay datos disponibles",
    "noCourseProgress": "Aún no has comenzado ningún curso",
    "noWishlist": "Tu lista de deseos está vacía"
  },

  "loading": {
    "loading": "Cargando...",
    "loadingCourses": "Cargando cursos...",
    "loadingProfile": "Cargando perfil...",
    "processing": "Procesando..."
  },

  "error": {
    "generic": "Algo salió mal",
    "network": "Error de red. Por favor, verifica tu conexión.",
    "notFound": "No encontrado",
    "unauthorized": "No estás autorizado para acceder a esto",
    "forbidden": "Acceso denegado",
    "serverError": "Error del servidor. Por favor, intenta más tarde.",
    "retry": "Reintentar"
  },

  "success": {
    "saved": "Guardado exitosamente",
    "created": "Creado exitosamente",
    "updated": "Actualizado exitosamente",
    "deleted": "Eliminado exitosamente",
    "completed": "Completado"
  },

  "confirmation": {
    "deleteItem": "¿Estás seguro de que deseas eliminar esto?",
    "confirmAction": "¿Estás seguro de que deseas continuar?",
    "unsavedChanges": "Tienes cambios sin guardar. ¿Deseas salir?"
  },

  "footer": {
    "about": "Acerca De",
    "contact": "Contacto",
    "privacy": "Política de Privacidad",
    "terms": "Términos de Servicio",
    "copyright": "© 2025 Mentor por Mentor. Todos los derechos reservados."
  }
}
```

**packages/i18n/locales/fr/common.json:** (French version with similar structure)

**packages/i18n/locales/ru/common.json:** (Russian version with similar structure)

### auth.json Structure

All authentication-related strings.

**packages/i18n/locales/en/auth.json:**

```json
{
  "page": {
    "login": "Login",
    "signup": "Sign Up",
    "forgotPassword": "Forgot Password?",
    "resetPassword": "Reset Password",
    "emailVerification": "Verify Your Email",
    "mfaSetup": "Two-Factor Authentication"
  },

  "label": {
    "email": "Email Address",
    "password": "Password",
    "confirmPassword": "Confirm Password",
    "newPassword": "New Password",
    "currentPassword": "Current Password",
    "firstName": "First Name",
    "lastName": "Last Name",
    "acceptTerms": "I agree to the Terms of Service and Privacy Policy",
    "rememberMe": "Remember me"
  },

  "placeholder": {
    "email": "you@example.com",
    "password": "••••••••",
    "firstName": "John",
    "lastName": "Doe"
  },

  "button": {
    "login": "Login",
    "signup": "Create Account",
    "sendReset": "Send Reset Link",
    "resetPassword": "Reset Password",
    "verifyEmail": "Verify Email",
    "resendCode": "Resend Code",
    "loginWithGoogle": "Login with Google",
    "loginWithApple": "Login with Apple"
  },

  "error": {
    "invalidEmail": "Please enter a valid email address",
    "emailExists": "This email is already registered",
    "passwordTooShort": "Password must be at least 8 characters",
    "passwordsMismatch": "Passwords do not match",
    "invalidPassword": "Password is incorrect",
    "emailNotFound": "Email not found",
    "accountLocked": "Account temporarily locked. Please try again later.",
    "invalidVerificationCode": "Verification code is invalid or expired",
    "tooManyAttempts": "Too many login attempts. Please try again later."
  },

  "message": {
    "checkEmail": "Check your email for a verification link",
    "resetSent": "Password reset link sent to your email",
    "emailVerified": "Email verified successfully",
    "passwordReset": "Password has been reset successfully",
    "signupSuccess": "Account created successfully. Welcome!"
  }
}
```

### course.json Structure

Course browsing, enrollment, and learning content.

**packages/i18n/locales/en/course.json:**

```json
{
  "page": {
    "browse": "Browse Courses",
    "courseDetail": "Course Details",
    "myLearning": "My Learning",
    "search": "Search Results"
  },

  "label": {
    "courseTitle": "Course Title",
    "description": "Description",
    "instructor": "Instructor",
    "category": "Category",
    "level": "Level",
    "duration": "Duration",
    "lessons": "Lessons",
    "modules": "Modules",
    "students": "Students Enrolled",
    "rating": "Rating",
    "price": "Price",
    "startDate": "Start Date",
    "endDate": "End Date",
    "progress": "Progress",
    "requirements": "Requirements",
    "learningObjectives": "What You'll Learn",
    "instructor_bio": "About the Instructor",
    "language": "Language"
  },

  "button": {
    "enroll": "Enroll Now",
    "continue": "Continue Learning",
    "start": "Start Course",
    "complete": "Mark as Complete",
    "viewLesson": "View Lesson",
    "nextLesson": "Next Lesson",
    "previousLesson": "Previous Lesson",
    "watchNow": "Watch Now",
    "downloadMaterials": "Download Materials",
    "addToWishlist": "Add to Wishlist",
    "removeFromWishlist": "Remove from Wishlist",
    "leaveReview": "Leave a Review"
  },

  "level": {
    "beginner": "Beginner",
    "intermediate": "Intermediate",
    "advanced": "Advanced",
    "expert": "Expert"
  },

  "empty": {
    "noCourses": "No courses match your search",
    "noEnrolled": "You're not enrolled in any courses yet",
    "noCompleted": "No completed courses",
    "noWishlist": "Your wishlist is empty"
  },

  "message": {
    "enrolled": "You're now enrolled in this course",
    "alreadyEnrolled": "You're already enrolled in this course",
    "completionPercentage": "{{progress}}% complete",
    "estimatedDuration": "Estimated duration: {{hours}} hours",
    "lastWatched": "Last watched: {{date}}"
  },

  "filter": {
    "category": "By Category",
    "level": "By Level",
    "price": "By Price",
    "rating": "By Rating",
    "duration": "By Duration",
    "instructor": "By Instructor"
  }
}
```

### mentor.json Structure

Mentor/instructor course creation and management.

**packages/i18n/locales/en/mentor.json:**

```json
{
  "page": {
    "dashboard": "Instructor Dashboard",
    "createCourse": "Create Course",
    "editCourse": "Edit Course",
    "uploadVideo": "Upload Video",
    "courseAnalytics": "Course Analytics",
    "studentManagement": "Student Management",
    "earnings": "Earnings"
  },

  "label": {
    "courseTitle": "Course Title",
    "description": "Course Description",
    "category": "Category",
    "level": "Level",
    "price": "Price",
    "thumbnail": "Course Thumbnail",
    "videoContent": "Video Content",
    "materials": "Course Materials",
    "requirements": "Prerequisites",
    "objectives": "Learning Objectives",
    "language": "Instruction Language"
  },

  "button": {
    "create": "Create Course",
    "save": "Save Course",
    "publish": "Publish Course",
    "unpublish": "Unpublish Course",
    "uploadVideo": "Upload Video",
    "addLesson": "Add Lesson",
    "addModule": "Add Module",
    "preview": "Preview"
  },

  "message": {
    "courseCreated": "Course created successfully",
    "coursePublished": "Course published successfully",
    "videoUploading": "Video uploading...",
    "videoUploaded": "Video uploaded successfully",
    "totalStudents": "{{count}} students enrolled",
    "totalRevenue": "Total earnings: {{amount}}"
  },

  "error": {
    "videoTooLarge": "Video file is too large",
    "invalidVideoFormat": "Invalid video format",
    "courseTitleRequired": "Course title is required",
    "descriptionTooShort": "Description must be at least 100 characters"
  }
}
```

### admin.json Structure

Super admin panel operations.

**packages/i18n/locales/en/admin.json:**

```json
{
  "page": {
    "dashboard": "Admin Dashboard",
    "users": "User Management",
    "courses": "Course Moderation",
    "payments": "Payment Management",
    "reports": "Reports",
    "settings": "Platform Settings",
    "logs": "System Logs"
  },

  "label": {
    "userId": "User ID",
    "userName": "User Name",
    "email": "Email",
    "role": "Role",
    "status": "Status",
    "createdAt": "Created",
    "lastActive": "Last Active",
    "courseId": "Course ID",
    "courseName": "Course Name",
    "instructor": "Instructor",
    "revenue": "Revenue",
    "students": "Students"
  },

  "button": {
    "approve": "Approve",
    "reject": "Reject",
    "ban": "Ban User",
    "suspend": "Suspend",
    "activate": "Activate",
    "delete": "Delete",
    "viewDetails": "View Details",
    "viewReports": "View Reports"
  },

  "action": {
    "userBanned": "User has been banned",
    "courseSuspended": "Course has been suspended",
    "paymentProcessed": "Payment processed successfully"
  }
}
```

### notification.json Structure

Toast messages, notifications, and alerts.

**packages/i18n/locales/en/notification.json:**

```json
{
  "success": {
    "saved": "Changes saved successfully",
    "deleted": "Item deleted successfully",
    "updated": "Updated successfully",
    "enrolled": "Enrollment successful",
    "paymentComplete": "Payment completed successfully"
  },

  "error": {
    "generic": "An error occurred. Please try again.",
    "network": "Network error. Check your connection.",
    "unauthorized": "You don't have permission to do this",
    "validation": "Please check your input",
    "serverError": "Server error. Please try again later."
  },

  "warning": {
    "unsavedChanges": "You have unsaved changes",
    "deleteConfirmation": "This action cannot be undone",
    "expiringSoon": "This offer expires soon"
  },

  "info": {
    "loading": "Loading...",
    "processing": "Processing your request...",
    "checkEmail": "Check your email for next steps"
  },

  "toast": {
    "actionSuccess": "{{action}} completed successfully",
    "actionFailed": "{{action}} failed. Please try again."
  }
}
```

### Validation Script

**scripts/validate-locales.js:**

```javascript
const fs = require("fs");
const path = require("path");

const LANGUAGES = ["en", "es", "fr", "ru"];
const NAMESPACES = [
  "common",
  "auth",
  "course",
  "mentor",
  "admin",
  "notification",
];
const LOCALES_DIR = path.join(__dirname, "../packages/i18n/locales");

function validateLocaleFiles() {
  const errors = [];

  for (const lang of LANGUAGES) {
    const langDir = path.join(LOCALES_DIR, lang);

    for (const ns of NAMESPACES) {
      const filePath = path.join(langDir, `${ns}.json`);

      if (!fs.existsSync(filePath)) {
        errors.push(`Missing file: ${lang}/${ns}.json`);
        continue;
      }

      try {
        const content = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // Validate all keys are strings
        const validateValues = (obj) => {
          for (const [key, value] of Object.entries(obj)) {
            if (typeof value === "object" && value !== null) {
              validateValues(value);
            } else if (typeof value !== "string") {
              errors.push(
                `${lang}/${ns}.json: Key '${key}' has non-string value`,
              );
            }
          }
        };

        validateValues(content);
      } catch (e) {
        errors.push(`${lang}/${ns}.json: Invalid JSON - ${e.message}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("Validation errors found:");
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log("✓ All locale files validated successfully");
  }
}

validateLocaleFiles();
```

## Implementation Order

1. Create directory structure in `packages/i18n/locales`
2. Create `en/common.json` with 200+ keys
3. Create `en/auth.json`, `en/course.json`, etc.
4. Copy EN files to ES, FR, RU directories
5. Add preliminary Spanish, French, Russian translations (can be placeholder)
6. Run validation script to ensure JSON validity
7. Commit all files to repository
8. Document translation workflow for localization team
9. Set up access for translators to update ES/FR/RU files
10. Create testing utilities for missing translation keys
