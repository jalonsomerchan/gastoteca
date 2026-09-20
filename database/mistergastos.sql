CREATE DATABASE IF NOT EXISTS mistergastos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mistergastos;

CREATE TABLE IF NOT EXISTS mg_schema_version (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  version INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_preferences (
  uid VARCHAR(128) NOT NULL,
  group_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (uid),
  KEY idx_mg_preferences_group (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL DEFAULT 'Mis gastos',
  owner_uid VARCHAR(128) NOT NULL,
  invite_code VARCHAR(8) NOT NULL,
  default_city VARCHAR(120) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mg_group_invite (invite_code),
  KEY idx_mg_group_owner (owner_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_group_members (
  group_id BIGINT UNSIGNED NOT NULL,
  uid VARCHAR(128) NOT NULL,
  email VARCHAR(255) NOT NULL DEFAULT '',
  name VARCHAR(190) NOT NULL DEFAULT '',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, uid),
  KEY idx_mg_member_uid (uid),
  CONSTRAINT fk_mg_member_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_group_invites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  status ENUM('pending','accepted','cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mg_group_invite_email (group_id, email),
  CONSTRAINT fk_mg_invite_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  category_key VARCHAR(80) NOT NULL,
  label VARCHAR(80) NOT NULL,
  icon VARCHAR(120) NOT NULL DEFAULT 'mdi:tag-outline',
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mg_category_key (group_id, category_key),
  UNIQUE KEY uq_mg_category_group_id (group_id, id),
  CONSTRAINT fk_mg_category_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_places (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  icon VARCHAR(120) NOT NULL DEFAULT 'mdi:store-outline',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mg_place_name (group_id, name),
  UNIQUE KEY uq_mg_place_group_id (group_id, id),
  CONSTRAINT fk_mg_place_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_cities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mg_city_name (group_id, name),
  UNIQUE KEY uq_mg_city_group_id (group_id, id),
  CONSTRAINT fk_mg_city_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('expense','income') NOT NULL DEFAULT 'expense',
  name VARCHAR(160) NOT NULL,
  details TEXT NULL,
  is_quick TINYINT(1) NOT NULL DEFAULT 0,
  category_id BIGINT UNSIGNED NOT NULL,
  place_id BIGINT UNSIGNED NULL,
  city_id BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_by_type ENUM('person','all') NOT NULL DEFAULT 'person',
  paid_by_uid VARCHAR(128) NULL,
  applies_to_all TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mg_expense_group_date (group_id, occurred_at),
  KEY idx_mg_expense_category_id (group_id, category_id),
  KEY idx_mg_expense_place_id (group_id, place_id),
  KEY idx_mg_expense_city_id (group_id, city_id),
  KEY idx_mg_expense_type (group_id, transaction_type),
  KEY idx_mg_expense_payer (group_id, paid_by_uid),
  CONSTRAINT fk_mg_expense_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_mg_expense_category_ref FOREIGN KEY (group_id, category_id) REFERENCES mg_categories(group_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_mg_expense_place_ref FOREIGN KEY (group_id, place_id) REFERENCES mg_places(group_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_mg_expense_city_ref FOREIGN KEY (group_id, city_id) REFERENCES mg_cities(group_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_expense_participants (
  expense_id BIGINT UNSIGNED NOT NULL,
  uid VARCHAR(128) NOT NULL,
  share_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (expense_id, uid),
  KEY idx_mg_participant_uid (uid),
  CONSTRAINT fk_mg_participant_expense FOREIGN KEY (expense_id) REFERENCES mg_expenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(40) NOT NULL,
  last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mg_tag_group_name (group_id, name),
  UNIQUE KEY uq_mg_tag_group_id (group_id, id),
  KEY idx_mg_tag_recent (group_id, last_used_at),
  CONSTRAINT fk_mg_tag_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_expense_tags (
  expense_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (expense_id, tag_id),
  KEY idx_mg_expense_tag_tag (tag_id),
  CONSTRAINT fk_mg_expense_tag_expense FOREIGN KEY (expense_id) REFERENCES mg_expenses(id) ON DELETE CASCADE,
  CONSTRAINT fk_mg_expense_tag_tag FOREIGN KEY (tag_id) REFERENCES mg_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_settlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  payer_uid VARCHAR(128) NOT NULL,
  payee_uid VARCHAR(128) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_at DATETIME NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mg_settlement_group_date (group_id, paid_at),
  CONSTRAINT fk_mg_settlement_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_budgets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  monthly_limit DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mg_budget_category (group_id, category_id),
  CONSTRAINT fk_mg_budget_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_mg_budget_category FOREIGN KEY (group_id, category_id) REFERENCES mg_categories(group_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_recurring_expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  frequency ENUM('weekly','monthly','yearly') NOT NULL,
  payload LONGTEXT NOT NULL,
  next_at DATETIME NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mg_recurring_due (group_id, active, next_at),
  CONSTRAINT fk_mg_recurring_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mg_telegram_preferences (
  group_id BIGINT UNSIGNED NOT NULL,
  uid VARCHAR(128) NOT NULL,
  notification_types VARCHAR(255) NOT NULL DEFAULT '[]',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, uid),
  CONSTRAINT fk_mg_telegram_preferences_group FOREIGN KEY (group_id) REFERENCES mg_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO mg_schema_version (id, version) VALUES (1, 2)
ON DUPLICATE KEY UPDATE version = VALUES(version);
