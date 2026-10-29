CREATE DATABASE IF NOT EXISTS UNIVERSIDAD;

USE UNIVERSIDAD;

CREATE TABLE IF NOT EXISTS FACULTADES (
                                          ID     INTEGER PRIMARY KEY AUTO_INCREMENT,
                                          NOMBRE VARCHAR(15) NOT NULL UNIQUE
                                      );

CREATE TABLE IF NOT EXISTS CARRERAS (
                                        ID          INTEGER PRIMARY KEY AUTO_INCREMENT,
                                        NOMBRE      VARCHAR(30) NOT NULL UNIQUE,
                                        ID_FACULTAD INTEGER     NOT NULL,
                                        CONSTRAINT FK_FACULTAD FOREIGN KEY (ID_FACULTAD) REFERENCES FACULTADES (ID)
                                    );

CREATE TABLE IF NOT EXISTS MATERIAS (
                                        ID          INTEGER PRIMARY KEY CHECK ( ID > 100000 ),
                                        NOMBRE      VARCHAR(30) NOT NULL UNIQUE,
                                        CREDITOS    INTEGER     NOT NULL CHECK ( CREDITOS > 0 ),
                                        ID_FACULTAD INTEGER     NOT NULL,
                                        CONSTRAINT FK_FACULTAD FOREIGN KEY (ID_FACULTAD) REFERENCES FACULTADES (ID)
                                    );

CREATE TABLE IF NOT EXISTS ESTUDIANTES (
                                           IDENTIFICACION VARCHAR(20) PRIMARY KEY,
                                           NOMBRES        VARCHAR(50) NOT NULL,
                                           APELLIDOS      VARCHAR(50) NOT NULL,
                                           CORREO         VARCHAR(70) NOT NULL UNIQUE,
                                           TELEFONO       VARCHAR(20) NOT NULL UNIQUE,
                                           ID_CARRERA     INTEGER     NOT NULL,
                                           CONSTRAINT FK_CARRERA FOREIGN KEY (ID_CARRERA) REFERENCES CARRERAS (ID)
                                       );

CREATE TABLE IF NOT EXISTS MATRICULAS (
                                          ID_MATRICULA    INTEGER PRIMARY KEY,
                                          IDENTIFICACION  VARCHAR(20) NOT NULL,
                                          CONSTRAINT FK_IDENTIFICACION FOREIGN KEY (IDENTIFICACION) REFERENCES ESTUDIANTES (IDENTIFICACION),
                                          COD_MATERIA     INTEGER     NOT NULL,
                                          CONSTRAINT FK_MATERIA FOREIGN KEY (COD_MATERIA) REFERENCES MATERIAS (ID),
                                          PERIODO         VARCHAR(7)  NOT NULL,
                                          FECHA_MATRICULA DATE        NOT NULL
                                      );

CREATE TABLE IF NOT EXISTS NOTAS (
                                     ID_NOTAS     INTEGER PRIMARY KEY AUTO_INCREMENT,
                                     ID_MATRICULA INTEGER       NOT NULL UNIQUE,
                                     CONSTRAINT FK_MATRICULA FOREIGN KEY (ID_MATRICULA) REFERENCES MATRICULAS (ID_MATRICULA),
                                     NOTA_1       DECIMAL(3, 2) NOT NULL CHECK ( NOTA_1 > 0.0 ),
                                     NOTA_2       DECIMAL(3, 2) NOT NULL CHECK ( NOTA_2 > 0.0 ),
                                     NOTA_3       DECIMAL(3, 2) NOT NULL CHECK ( NOTA_3 > 0.0 ),
                                     PROMEDIO     DECIMAL(3, 2) NOT NULL CHECK ( PROMEDIO > 0.0 )
                                 );
