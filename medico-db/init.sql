-- =========================
-- Tipos enumerados
-- =========================
CREATE TYPE consulta_estado AS ENUM ('abierta','cerrada');
CREATE TYPE codigo_estado   AS ENUM ('emitido','usado','expirado','anulado');

-- =========================
-- Entidades principales
-- =========================
CREATE TABLE aseguradora (
  id_aseguradora   BIGSERIAL PRIMARY KEY,
  nombre           VARCHAR(100)  NOT NULL,
  contacto         VARCHAR(100)
);

CREATE TABLE especialidad (
  id_especialidad  BIGSERIAL PRIMARY KEY,
  nombre           VARCHAR(100)  NOT NULL
);

CREATE TABLE medicos (
  id                BIGSERIAL PRIMARY KEY,
  nombre            TEXT         NOT NULL,
  cedula_profesional TEXT        NOT NULL UNIQUE,
  id_especialidad   BIGINT       REFERENCES especialidad(id_especialidad)
                                 ON UPDATE CASCADE ON DELETE RESTRICT,
  telefono          TEXT,
  correo            TEXT         NOT NULL UNIQUE,
  ubicacion         TEXT,
  descripcion       TEXT
);

CREATE TABLE pacientes (
  id            BIGSERIAL PRIMARY KEY,
  nombre        TEXT         NOT NULL,
  edad          INT,
  peso          NUMERIC(5,2),
  alergias      TEXT,
  correo        TEXT         UNIQUE,
  estado_civil  TEXT,
  estilo_vida   TEXT,
  poliza        TEXT,            -- dato libre (la relación formal está en 'poliza')
  sexo          VARCHAR(10),
  altura        NUMERIC(5,2),
  tipo_sangre   VARCHAR(5),
  telefono      TEXT,
  direccion     TEXT,
  ocupacion     TEXT,
  aseguradora   TEXT,            -- dato libre (la relación formal está en 'poliza')
  nss           TEXT
);

CREATE TABLE poliza (
  id_poliza      BIGSERIAL PRIMARY KEY,
  id_paciente    BIGINT  NOT NULL REFERENCES pacientes(id)
                          ON UPDATE CASCADE ON DELETE CASCADE,
  id_aseguradora BIGINT  NOT NULL REFERENCES aseguradora(id_aseguradora)
                          ON UPDATE CASCADE ON DELETE RESTRICT,
  numero_poliza  VARCHAR(100) NOT NULL,
  vigente_desde  DATE         NOT NULL,
  vigente_hasta  DATE         -- NULL => vigente
);

CREATE TABLE cita (
  id_cita     BIGSERIAL PRIMARY KEY,
  id_paciente BIGINT NOT NULL REFERENCES pacientes(id)
                     ON UPDATE CASCADE ON DELETE CASCADE,
  id_medico   BIGINT NOT NULL REFERENCES medicos(id)
                     ON UPDATE CASCADE ON DELETE RESTRICT,
  fecha       DATE   NOT NULL,
  hora        TIME   NOT NULL
);

CREATE TABLE consulta (
  id_consulta      BIGSERIAL PRIMARY KEY,
  id_cita          BIGINT      REFERENCES cita(id_cita)
                               ON UPDATE CASCADE ON DELETE SET NULL,
  id_paciente      BIGINT      NOT NULL REFERENCES pacientes(id)
                               ON UPDATE CASCADE ON DELETE RESTRICT,
  id_medico        BIGINT      NOT NULL REFERENCES medicos(id)
                               ON UPDATE CASCADE ON DELETE RESTRICT,
  fecha_hora       TIMESTAMP   NOT NULL,
  estado           consulta_estado NOT NULL DEFAULT 'abierta',
  mongo_consulta_id CHAR(24)   -- ObjectId (hex) del documento en Mongo (opcional)
);

CREATE TABLE administrador (
  id_admin      BIGSERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  correo        VARCHAR(150) NOT NULL UNIQUE,
  telefono      VARCHAR(20),
  hash_password VARCHAR(255) NOT NULL
);

CREATE TABLE acceso_paciente_codigo (
  id_codigo   BIGSERIAL PRIMARY KEY,
  codigo      TEXT    NOT NULL UNIQUE,    -- código único de acceso
  id_medico   BIGINT  NOT NULL REFERENCES medicos(id)
                      ON UPDATE CASCADE ON DELETE RESTRICT,
  id_paciente BIGINT  NOT NULL REFERENCES pacientes(id)
                      ON UPDATE CASCADE ON DELETE CASCADE,
  expira_en   TIMESTAMP NOT NULL,
  usado_en    TIMESTAMP,
  estado      codigo_estado NOT NULL DEFAULT 'emitido'
);

-- =========================
-- Índices sugeridos
-- =========================
CREATE INDEX idx_medicos_especialidad   ON medicos(id_especialidad);
CREATE INDEX idx_cita_medico_fecha      ON cita(id_medico, fecha);
CREATE INDEX idx_cita_paciente_fecha    ON cita(id_paciente, fecha);
CREATE INDEX idx_poliza_paciente        ON poliza(id_paciente);
CREATE INDEX idx_consulta_paciente_fecha ON consulta(id_paciente, fecha_hora DESC);
CREATE INDEX idx_acc_codigo_estado      ON acceso_paciente_codigo(codigo, estado);

BEGIN;

-- =========================
-- 1) ASEGURADORA (15)
-- =========================
INSERT INTO aseguradora (id_aseguradora, nombre, contacto) VALUES
 (1,'VidaSalud Seguros','800 111 0001'),
 (2,'ProtecSalud','800 111 0002'),
 (3,'SaludPlus','800 111 0003'),
 (4,'MediCare MX','800 111 0004'),
 (5,'Seguros Integral','800 111 0005'),
 (6,'Salud Total','800 111 0006'),
 (7,'Vida Plena','800 111 0007'),
 (8,'Clínica Segura','800 111 0008'),
 (9,'Salud y Vida','800 111 0009'),
 (10,'Seguros Horizonte','800 111 0010'),
 (11,'Salud Premium','800 111 0011'),
 (12,'Bienestar MX','800 111 0012'),
 (13,'Seguros Alfa','800 111 0013'),
 (14,'SaludCare','800 111 0014'),
 (15,'Vitalis Seguros','800 111 0015');

-- =========================
-- 2) ESPECIALIDAD (15)
-- =========================
INSERT INTO especialidad (id_especialidad, nombre) VALUES
 (1,'Medicina Interna'),
 (2,'Cardiología'),
 (3,'Pediatría'),
 (4,'Ginecología'),
 (5,'Traumatología'),
 (6,'Dermatología'),
 (7,'Endocrinología'),
 (8,'Neurología'),
 (9,'Otorrinolaringología'),
 (10,'Gastroenterología'),
 (11,'Neumología'),
 (12,'Urología'),
 (13,'Oftalmología'),
 (14,'Psiquiatría'),
 (15,'Rehabilitación');

-- =========================
-- 3) MÉDICOS (15)
-- =========================
INSERT INTO medicos
 (id, nombre, cedula_profesional, id_especialidad, telefono, correo, ubicacion, descripcion)
VALUES
 (1,'Dra. Sofía Hernández','MX12345001',1,'+52 81 5555 1001','sofia.hernandez@clinica.mx','Monterrey, NL','Internista enfocada en crónicos.'),
 (2,'Dr. Luis Martínez','MX12345002',2,'+52 55 5000 2211','luis.martinez@cardio.mx','CDMX','Cardiólogo clínico.'),
 (3,'Dra. Ana Torres','MX12345003',3,'+52 33 4444 3303','ana.torres@pediatria.mx','Guadalajara, JAL','Pediatra hospitalaria.'),
 (4,'Dra. Paula Gómez','MX12345004',4,'+52 81 5555 1404','paula.gomez@gine.mx','San Pedro, NL','Ginecóloga obstetra.'),
 (5,'Dr. Ernesto Díaz','MX12345005',5,'+52 55 5000 2505','ernesto.diaz@trauma.mx','CDMX','Traumatólogo deportivo.'),
 (6,'Dra. Mónica Ruiz','MX12345006',6,'+52 81 5555 1606','monica.ruiz@derma.mx','Monterrey, NL','Dermatóloga clínica.'),
 (7,'Dr. Ricardo Vela','MX12345007',7,'+52 55 5000 2707','ricardo.vela@endo.mx','CDMX','Endocrinólogo diabetes/tiroides.'),
 (8,'Dra. Camila Ortiz','MX12345008',8,'+52 33 4444 3808','camila.ortiz@neuro.mx','Zapopan, JAL','Neuróloga.'),
 (9,'Dr. Mateo Salas','MX12345009',9,'+52 81 5555 1909','mateo.salas@oto.mx','Monterrey, NL','Otorrinolaringólogo.'),
 (10,'Dr. Daniel Pineda','MX12345010',10,'+52 55 5000 3010','daniel.pineda@gastro.mx','CDMX','Gastroenterólogo.'),
 (11,'Dra. Laura Chávez','MX12345011',11,'+52 33 4444 4011','laura.chavez@neumo.mx','Guadalajara, JAL','Neumóloga.'),
 (12,'Dr. Pablo Aranda','MX12345012',12,'+52 81 5555 2112','pablo.aranda@uro.mx','San Nicolás, NL','Urólogo.'),
 (13,'Dra. Irene Ríos','MX12345013',13,'+52 55 5000 3213','irene.rios@oftal.mx','CDMX','Oftalmóloga.'),
 (14,'Dr. Julián Herrera','MX12345014',14,'+52 33 4444 4314','julian.herrera@psiq.mx','Tlaquepaque, JAL','Psiquiatra.'),
 (15,'Dra. Teresa Flores','MX12345015',15,'+52 81 5555 2215','teresa.flores@rehab.mx','Monterrey, NL','Rehabilitación física.');

-- =========================
-- 4) PACIENTES (15)
-- =========================
INSERT INTO pacientes
 (id, nombre, edad, peso, alergias, correo, estado_civil, estilo_vida, poliza, sexo, altura,
  tipo_sangre, telefono, direccion, ocupacion, aseguradora, nss)
VALUES
 (1,'Juan Pérez',42,82.5,'Penicilina','juan.perez@example.com','Casado','Activo (corre 3x/sem)','VS-0001','M',175.0,'O+','+52 81 7777 3001','San Pedro, NL','Ingeniero de software','VidaSalud Seguros','IMSS-428001'),
 (2,'María López',35,64.2,'N/A','maria.lopez@example.com','Soltera','Camina diario','PR-0002','F',165.0,'A+','+52 55 6000 4402','Benito Juárez, CDMX','Diseñadora gráfica','ProtecSalud','IMSS-356220'),
 (3,'Carlos Ramírez',29,75.8,'Aspirina','carlos.ramirez@example.com','Soltero','Sedentario',NULL,'M',178.0,'B+','+52 33 4444 8899','Zapopan, JAL','Analista de datos',NULL,'IMSS-290775'),
 (4,'Laura Mendoza',51,70.1,'Mariscos','laura.mendoza@example.com','Casada','Moderado','SP-0004','F',162.0,'O-','+52 55 7000 1104','Coyoacán, CDMX','Administradora','SaludPlus','IMSS-510044'),
 (5,'Miguel Andrade',46,90.3,'N/A','miguel.andrade@example.com','Casado','Activo','MC-0005','M',180.0,'A-','+52 81 8888 5505','Monterrey, NL','Gerente ventas','MediCare MX','IMSS-460055'),
 (6,'Andrea Cruz',23,58.0,'Lactosa','andrea.cruz@example.com','Soltera','Ciclismo','SI-0006','F',168.0,'AB+','+52 33 9900 2206','Guadalajara, JAL','Estudiante','Seguros Integral','IMSS-230066'),
 (7,'Pedro Salgado',37,84.6,'N/A','pedro.salgado@example.com','Casado','Gym 2x/sem','ST-0007','M',176.0,'O+','+52 55 6111 7707','Iztapalapa, CDMX','Contador','Salud Total','IMSS-370077'),
 (8,'Daniela Rivas',31,60.7,'Gluten','daniela.rivas@example.com','Soltera','Yoga','VP-0008','F',170.0,'B-','+52 81 9000 3308','Apodaca, NL','Arquitecta','Vida Plena','IMSS-310088'),
 (9,'Sergio Núñez',27,79.2,'N/A','sergio.nunez@example.com','Soltero','Ciclismo','CS-0009','M',182.0,'A+','+52 33 6600 9909','Tlaquepaque, JAL','Fotógrafo','Clínica Segura','IMSS-270099'),
 (10,'Paulina Vázquez',40,68.9,'Polen','paulina.vazquez@example.com','Casada','Pilates','SV-0010','F',166.0,'A+','+52 55 7333 4410','Miguel Hidalgo, CDMX','Abogada','Salud y Vida','IMSS-400110'),
 (11,'Héctor Campos',33,86.0,'N/A','hector.campos@example.com','Casado','Sedentario','SH-0011','M',177.0,'O+','+52 81 4444 6611','Guadalupe, NL','Vendedor','Seguros Horizonte','IMSS-330111'),
 (12,'Elena Ortiz',52,72.4,'Nuez','elena.ortiz@example.com','Viuda','Caminatas','SPRE-0012','F',163.0,'AB-','+52 55 8400 2212','Álvaro Obregón, CDMX','Docente','Salud Premium','IMSS-520112'),
 (13,'Valeria Soto',26,56.5,'N/A','valeria.soto@example.com','Soltera','Activa','BIE-0013','F',164.0,'O+','+52 33 2222 4413','Zapopan, JAL','Community manager','Bienestar MX','IMSS-260113'),
 (14,'Rodrigo Pérez',48,91.1,'Ibuprofeno','rodrigo.perez@example.com','Casado','Ciclismo','ALF-0014','M',179.0,'B+','+52 55 9200 7714','Naucalpan, EDOMEX','Director','Seguros Alfa','IMSS-480114'),
 (15,'Lucía Navarro',39,62.3,'N/A','lucia.navarro@example.com','Divorciada','Camina diario','SC-0015','F',167.0,'A-','+52 81 5111 8815','San Nicolás, NL','Analista financiera','SaludCare','IMSS-390115');

-- =========================
-- 5) PÓLIZA (15)
-- =========================
INSERT INTO poliza
 (id_poliza, id_paciente, id_aseguradora, numero_poliza, vigente_desde, vigente_hasta)
VALUES
 (1,1,1,'VS-0001',DATE '2024-01-01',NULL),
 (2,2,2,'PR-0002',DATE '2024-06-15',NULL),
 (3,3,3,'SP-0003',DATE '2023-09-01',DATE '2024-09-01'),
 (4,4,3,'SP-0004',DATE '2024-02-01',NULL),
 (5,5,4,'MC-0005',DATE '2024-03-10',NULL),
 (6,6,5,'SI-0006',DATE '2024-04-01',NULL),
 (7,7,6,'ST-0007',DATE '2024-05-01',NULL),
 (8,8,7,'VP-0008',DATE '2024-03-20',NULL),
 (9,9,8,'CS-0009',DATE '2024-07-01',NULL),
 (10,10,9,'SV-0010',DATE '2024-05-15',NULL),
 (11,11,10,'SH-0011',DATE '2024-08-01',NULL),
 (12,12,11,'SPRE-0012',DATE '2024-01-15',NULL),
 (13,13,12,'BIE-0013',DATE '2024-09-01',NULL),
 (14,14,13,'ALF-0014',DATE '2024-02-20',NULL),
 (15,15,14,'SC-0015',DATE '2024-06-01',NULL);

-- =========================
-- 6) CITA (15)
-- =========================
INSERT INTO cita
 (id_cita, id_paciente, id_medico, fecha, hora)
VALUES
 (1,1,1,DATE '2025-09-10',TIME '10:30'),
 (2,2,2,DATE '2025-09-13',TIME '09:00'),
 (3,3,1,DATE '2025-09-15',TIME '12:00'),
 (4,4,10,DATE '2025-09-16',TIME '11:15'),
 (5,5,2,DATE '2025-09-17',TIME '08:45'),
 (6,6,6,DATE '2025-09-18',TIME '16:00'),
 (7,7,7,DATE '2025-09-20',TIME '10:00'),
 (8,8,8,DATE '2025-09-21',TIME '14:30'),
 (9,9,9,DATE '2025-09-22',TIME '09:45'),
 (10,10,11,DATE '2025-09-23',TIME '13:00'),
 (11,11,12,DATE '2025-09-24',TIME '15:30'),
 (12,12,4,DATE '2025-09-25',TIME '09:30'),
 (13,13,5,DATE '2025-09-26',TIME '10:15'),
 (14,14,13,DATE '2025-09-27',TIME '08:30'),
 (15,15,15,DATE '2025-09-28',TIME '11:45');

-- =========================
-- 7) CONSULTA (15)
-- =========================
INSERT INTO consulta
 (id_consulta, id_cita, id_paciente, id_medico, fecha_hora, estado, mongo_consulta_id)
VALUES
 (1,1,1,1,TIMESTAMP '2025-09-10 10:45:00','cerrada','6510f9d3c9a4b7f8e1a2b3c1'),
 (2,2,2,2,TIMESTAMP '2025-09-13 09:30:00','cerrada','6510f9d3c9a4b7f8e1a2b3c2'),
 (3,3,3,1,TIMESTAMP '2025-09-15 12:20:00','abierta',NULL),
 (4,4,4,10,TIMESTAMP '2025-09-16 11:45:00','cerrada','6510f9d3c9a4b7f8e1a2b3c4'),
 (5,5,5,2,TIMESTAMP '2025-09-17 09:10:00','abierta',NULL),
 (6,6,6,6,TIMESTAMP '2025-09-18 16:20:00','cerrada','6510f9d3c9a4b7f8e1a2b3c6'),
 (7,7,7,7,TIMESTAMP '2025-09-20 10:25:00','cerrada','6510f9d3c9a4b7f8e1a2b3c7'),
 (8,8,8,8,TIMESTAMP '2025-09-21 15:05:00','abierta',NULL),
 (9,9,9,9,TIMESTAMP '2025-09-22 10:05:00','cerrada','6510f9d3c9a4b7f8e1a2b3c9'),
 (10,10,10,11,TIMESTAMP '2025-09-23 13:25:00','abierta',NULL),
 (11,11,11,12,TIMESTAMP '2025-09-24 15:55:00','cerrada','6510f9d3c9a4b7f8e1a2b3d1'),
 (12,12,12,4,TIMESTAMP '2025-09-25 09:50:00','cerrada','6510f9d3c9a4b7f8e1a2b3d2'),
 (13,13,13,5,TIMESTAMP '2025-09-26 10:40:00','cerrada','6510f9d3c9a4b7f8e1a2b3d3'),
 (14,14,14,13,TIMESTAMP '2025-09-27 08:55:00','abierta',NULL),
 (15,15,15,15,TIMESTAMP '2025-09-28 12:05:00','cerrada','6510f9d3c9a4b7f8e1a2b3d5');

-- =========================
-- 8) ADMINISTRADOR (15)
-- (usa un hash bcrypt placeholder para todos)
-- =========================
INSERT INTO administrador
 (id_admin, nombre, correo, telefono, hash_password)
VALUES
 (1,'Admin General','admin1@asmed.mx','555-010-1001','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (2,'Admin Norte','admin2@asmed.mx','555-010-1002','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (3,'Admin Sur','admin3@asmed.mx','555-010-1003','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (4,'Admin Centro','admin4@asmed.mx','555-010-1004','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (5,'Admin Occidente','admin5@asmed.mx','555-010-1005','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (6,'Admin Oriente','admin6@asmed.mx','555-010-1006','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (7,'Admin Soporte','admin7@asmed.mx','555-010-1007','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (8,'Admin Cuentas','admin8@asmed.mx','555-010-1008','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (9,'Admin Operaciones','admin9@asmed.mx','555-010-1009','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (10,'Admin Clínico','admin10@asmed.mx','555-010-1010','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (11,'Admin Proyecto','admin11@asmed.mx','555-010-1011','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (12,'Admin Seguridad','admin12@asmed.mx','555-010-1012','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (13,'Admin QA','admin13@asmed.mx','555-010-1013','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (14,'Admin DevOps','admin14@asmed.mx','555-010-1014','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst'),
 (15,'Admin Datos','admin15@asmed.mx','555-010-1015','$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxYZ0123456789abcdEFGHijklmnopqrst');

-- =========================
-- 9) ACCESO_PACIENTE_CODIGO (15)
-- =========================
INSERT INTO acceso_paciente_codigo
 (id_codigo, codigo, id_medico, id_paciente, expira_en, usado_en, estado)
VALUES
 (1,'MX-9F3K-2025-001',1,3, TIMESTAMP '2025-09-30 23:59:59', NULL,'emitido'),
 (2,'MX-9F3K-2025-002',2,1, TIMESTAMP '2025-09-20 23:59:59', TIMESTAMP '2025-09-18 10:00:00','usado'),
 (3,'MX-9F3K-2025-003',3,2, TIMESTAMP '2025-10-05 23:59:59', NULL,'emitido'),
 (4,'MX-9F3K-2025-004',4,4, TIMESTAMP '2025-08-31 23:59:59', NULL,'expirado'),
 (5,'MX-9F3K-2025-005',5,5, TIMESTAMP '2025-09-25 23:59:59', TIMESTAMP '2025-09-22 09:12:00','usado'),
 (6,'MX-9F3K-2025-006',6,6, TIMESTAMP '2025-09-29 23:59:59', NULL,'emitido'),
 (7,'MX-9F3K-2025-007',7,7, TIMESTAMP '2025-09-15 23:59:59', NULL,'anulado'),
 (8,'MX-9F3K-2025-008',8,8, TIMESTAMP '2025-10-01 23:59:59', NULL,'emitido'),
 (9,'MX-9F3K-2025-009',9,9, TIMESTAMP '2025-09-22 12:00:00', TIMESTAMP '2025-09-21 18:40:00','usado'),
 (10,'MX-9F3K-2025-010',10,10, TIMESTAMP '2025-10-10 23:59:59', NULL,'emitido'),
 (11,'MX-9F3K-2025-011',11,11, TIMESTAMP '2025-09-18 23:59:59', NULL,'expirado'),
 (12,'MX-9F3K-2025-012',12,12, TIMESTAMP '2025-10-15 23:59:59', NULL,'emitido'),
 (13,'MX-9F3K-2025-013',13,13, TIMESTAMP '2025-09-26 23:59:59', TIMESTAMP '2025-09-26 08:10:00','usado'),
 (14,'MX-9F3K-2025-014',14,14, TIMESTAMP '2025-10-20 23:59:59', NULL,'emitido'),
 (15,'MX-9F3K-2025-015',15,15, TIMESTAMP '2025-10-31 23:59:59', NULL,'emitido');

COMMIT;

-- Alinear secuencias
SELECT setval(pg_get_serial_sequence('aseguradora','id_aseguradora'), (SELECT MAX(id_aseguradora) FROM aseguradora));
SELECT setval(pg_get_serial_sequence('especialidad','id_especialidad'), (SELECT MAX(id_especialidad) FROM especialidad));
SELECT setval(pg_get_serial_sequence('medicos','id'), (SELECT MAX(id) FROM medicos));
SELECT setval(pg_get_serial_sequence('pacientes','id'), (SELECT MAX(id) FROM pacientes));
SELECT setval(pg_get_serial_sequence('poliza','id_poliza'), (SELECT MAX(id_poliza) FROM poliza));
SELECT setval(pg_get_serial_sequence('cita','id_cita'), (SELECT MAX(id_cita) FROM cita));
SELECT setval(pg_get_serial_sequence('consulta','id_consulta'), (SELECT MAX(id_consulta) FROM consulta));
SELECT setval(pg_get_serial_sequence('administrador','id_admin'), (SELECT MAX(id_admin) FROM administrador));
SELECT setval(pg_get_serial_sequence('acceso_paciente_codigo','id_codigo'), (SELECT MAX(id_codigo) FROM acceso_paciente_codigo));