CREATE TABLE `collection` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(32) UNIQUE NOT NULL DEFAULT '',
  `name` varchar(32) NOT NULL DEFAULT '',
  `contract_address` varchar(64) UNIQUE NOT NULL DEFAULT '',
  `description` varchar(1024) NOT NULL DEFAULT '',
  `chain` varchar(16) NOT NULL DEFAULT '',
  `total_supply` int NOT NULL DEFAULT 0,
  `current_supply` int NOT NULL DEFAULT 0,
  `total_revealed` int NOT NULL DEFAULT 0,
  `banner_image_url` varchar(256) NOT NULL DEFAULT '',
  `image_url` varchar(256) NOT NULL DEFAULT '',
  `tokens`  longtext NOT NULL,
  `traits`  mediumtext NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;