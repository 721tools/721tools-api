-- 操作手册:
-- 1. 登陆 mysql 机器
-- 2. root 身份建库建表
-- `mysql -uroot -h 127.0.0.1 -pMIIBIjANBgkqhkiG9 < table.sql`
-- 3. 授权 721tools 账户使用数据库
-- `GRANT ALL PRIVILEGES ON `721tools_platform`.* TO '721tools'@'%';`
-- `FLUSH PRIVILEGES;`

DROP DATABASE IF EXISTS `721tools_platform`;
CREATE DATABASE `721tools_platform`;
USE `721tools_platform`;

DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `address` varchar(64) NOT NULL DEFAULT '',
  `smart_address` varchar(64) NOT NULL DEFAULT '',
  `valid` tinyint NOT NULL DEFAULT 0,
  `type` varchar(16) NOT NULL DEFAULT '',
  `expiration_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `last_login_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX (`address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `smart_buys`;
CREATE TABLE `smart_buys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL DEFAULT 0,
  `slug` varchar(128) NOT NULL DEFAULT '', 
  `contract_address` varchar(64) NOT NULL DEFAULT '',
  `min_rank` int NOT NULL DEFAULT 0,
  `max_rank` int NOT NULL DEFAULT 0,
  `amount` int NOT NULL DEFAULT 0,
  `purchased` int NOT NULL DEFAULT 0,
  `price` decimal(12, 4) NOT NULL DEFAULT 0,
  `token_ids` varchar(256) NOT NULL DEFAULT '', /* split by , */
  `traits` JSON,
  `status` varchar(16) NOT NULL DEFAULT '',
  `error_code` varchar(32) NOT NULL DEFAULT '',
  `error_details` varchar(256) NOT NULL DEFAULT '',
  `expiration_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `last_scan_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX (`contract_address`, `status`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `smart_buy_logs`;
CREATE TABLE `smart_buy_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL DEFAULT 0,
  `contract_address` varchar(64) NOT NULL DEFAULT '',
  `smart_buy_id` int NOT NULL DEFAULT 0,
  `type` varchar(16) NOT NULL DEFAULT '',
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX (`user_id`, `contract_address`, `smart_buy_id`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `whitelist`;
CREATE TABLE `whitelist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `address` varchar(64) NOT NULL DEFAULT '',
  `owner` varchar(16) NOT NULL DEFAULT '',
  `remark` varchar(32) NOT NULL DEFAULT '',
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY (`address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


DROP TABLE IF EXISTS `limit_orders`;
CREATE TABLE `limit_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL DEFAULT 0,
  `slug` varchar(128) NOT NULL DEFAULT '', 
  `contract_address` varchar(64) NOT NULL DEFAULT '',
  `amount` int NOT NULL DEFAULT 0,
  `purchased` int NOT NULL DEFAULT 0,
  `price` decimal(12, 4) NOT NULL DEFAULT 0,
  `traits` JSON,
  `skip_flagged` tinyint NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT '',
  `error_code` varchar(32) NOT NULL DEFAULT '',
  `error_details` varchar(256) NOT NULL DEFAULT '',
  `expiration_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX (`contract_address`, `status`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `order_buy_logs`;
CREATE TABLE `order_buy_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL DEFAULT 0,
  `contract_address` varchar(64) NOT NULL DEFAULT '',
  `order_id` int NOT NULL DEFAULT 0,
  `token_id` varchar(256) NOT NULL DEFAULT '',
  `tx` char(66) NOT NULL DEFAULT '',
  `success` tinyint NOT NULL DEFAULT 0,
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX (`user_id`, `contract_address`, `order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
