-- 操作手册:
-- 1. 登陆 mysql 机器
-- 2. root 身份建库建表
-- `mysql -uroot -h 127.0.0.1 -pMIIBIjANBgkqhkiG9 < table.sql`
-- 3. 授权 721tools 账户使用数据库
-- `GRANT ALL PRIVILEGES ON `721tools-ethereum-nft-assets`.* TO '721tools'@'%';`
-- `FLUSH PRIVILEGES;`

DROP DATABASE IF EXISTS `721tools_ethereum_nft_assets`;
CREATE DATABASE `721tools_ethereum_nft_assets`;
USE `721tools_ethereum_nft_assets`;
-- only support erc721 by now
DROP TABLE IF EXISTS `contracts`;
CREATE TABLE `contracts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `status` tinyint NOT NULL DEFAULT 0, /* 0: created; 1: deleted ....*/
  `contract_address` varchar(64) NOT NULL DEFAULT '',
  `creator_address` varchar(64) NOT NULL DEFAULT '',
  `created_at_block_id` int NOT NULL DEFAULT 0,
  `created_at_tx` varchar(128) NOT NULL DEFAULT '',
  `is_open_source` tinyint NOT NULL DEFAULT 0, /* 0 or 1 */
  `code` longtext NOT NULL,
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE(`contract_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tokens`;
CREATE TABLE `tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token_address` varchar(128) NOT NULL DEFAULT '',  -- alias: token_id
  `contract_id` int NOT NULL DEFAULT 0,  
  `contract_address` varchar(64) NOT NULL DEFAULT '',
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE(`contract_address`, `token_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tx` varchar(128) UNIQUE NOT NULL DEFAULT '',
  `token_address` varchar(128) NOT NULL DEFAULT '',  
  `contract_id` int NOT NULL DEFAULT 0,
  `contract_address` varchar(64) NOT NULL DEFAULT '',
  `from_address` varchar(64) NOT NULL DEFAULT '',
  `calldata` longtext NOT NULL,
  `value` decimal(12,4) NOT NULL DEFAULT 0,
  `gas_price` varchar(32) NOT NULL DEFAULT '0',
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE(`tx`)  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- insert contract_address
-- update from opensea api
DROP TABLE IF EXISTS `opensea_collections`;
CREATE TABLE `opensea_collections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `status` tinyint NOT NULL DEFAULT 0, /* 0: created; 1: deleted ....*/
  `slug` varchar(128) NOT NULL DEFAULT '',
  `name` varchar(128) NOT NULL DEFAULT '',
  `schema` varchar(16) NOT NULL DEFAULT '',
  `contract_id` int NOT NULL DEFAULT 0,  
  `contract_address` varchar(64) NOT NULL DEFAULT '',
  `description` text,
  `from_index` int NOT NULL DEFAULT 0,
  `end_index` int NOT NULL DEFAULT 0,  
  `total_supply` int NOT NULL DEFAULT 0,
  `current_supply` int NOT NULL DEFAULT 0,
  `total_revealed` int NOT NULL DEFAULT 0,
  `banner_image_url` varchar(256) NOT NULL DEFAULT '',
  `image_url` varchar(256) NOT NULL DEFAULT '',
  `etherscan_url` varchar(256) NOT NULL DEFAULT '',
  `external_url` varchar(256) NOT NULL DEFAULT '',  
  `wiki_url` varchar(256) NOT NULL DEFAULT '',  
  `discord_url` varchar(256) NOT NULL DEFAULT '',
  `twitter_username` varchar(32) NOT NULL DEFAULT '',  
  `instagram_username` varchar(32) NOT NULL DEFAULT '',    
  `takerRelayerFee` int NOT NULL DEFAULT 750,
  `num_owners` int NOT NULL DEFAULT 0,
  `total_sales` int NOT NULL DEFAULT 0,
  `thirty_day_sales` int NOT NULL DEFAULT 0,
  `seven_day_sales` int NOT NULL DEFAULT 0,
  `one_day_sales` int NOT NULL DEFAULT 0,
  `one_day_volume` decimal(12,4) NOT NULL DEFAULT 0,
  `seven_day_volume` decimal(12,4) NOT NULL DEFAULT 0,
  `thirty_day_volume` decimal(12,4) NOT NULL DEFAULT 0,
  `total_volume` decimal(12,4) NOT NULL DEFAULT 0,
  `market_cap` decimal(12,4) NOT NULL DEFAULT 0,
  `floor_price` decimal(12,4) NOT NULL DEFAULT 0,
  `created_date` varchar(32) NOT NULL DEFAULT '',
  `token` varchar(256) NOT NULL DEFAULT '',
  `traits` JSON,
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE(`contract_address`, `token`),
  INDEX (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `opensea_items`;
CREATE TABLE `opensea_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token_id` int NOT NULL DEFAULT 0,
  `token_address` varchar(128) NOT NULL DEFAULT '',  
  `asset_id` int NOT NULL DEFAULT 0,
  `status` tinyint NOT NULL DEFAULT 0, /* 0: created; 1: deleted ....*/
  `collection_id` int NOT NULL DEFAULT 0,
  `collection_name` varchar(128) NOT NULL DEFAULT '',
  `collection_description` text,
  `collection_slug` varchar(128) NOT NULL DEFAULT '',   
  `contract_id` int NOT NULL DEFAULT 0,
  `contract_address` varchar(64) NOT NULL DEFAULT '',
  `name` varchar(128) NOT NULL DEFAULT '',
  `owner_address` varchar(64) NOT NULL DEFAULT '',
  `image_url` varchar(256) NOT NULL DEFAULT '',
  `image_original_url` varchar(256) NOT NULL DEFAULT '',
  `traits` JSON,
  `traits_score` int NOT NULL DEFAULT 0,
  `traits_rank` int NOT NULL DEFAULT 0,
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE(`contract_address`, `token_address`)  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- insert & select 操作，按周归档
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `status` tinyint NOT NULL DEFAULT 0, /* 0: created; 1: deleted ....*/
  `collection_id` int NOT NULL DEFAULT 0,
  `collection_name` varchar(128) NOT NULL DEFAULT '',
  `collection_description` text,
  `collection_slug` varchar(128) NOT NULL DEFAULT '',   
  `contract_id` int NOT NULL DEFAULT 0,
  `contract_address` varchar(64) NOT NULL DEFAULT '',
  `token_id` int NOT NULL DEFAULT 0,
  `token_address` varchar(128) NOT NULL DEFAULT '',
  `owner_address` varchar(64) NOT NULL DEFAULT '',
  `from` tinyint NOT NULL DEFAULT 0, /* 0: opensea; 1: looksrare ....*/
  `type` tinyint NOT NULL DEFAULT 0, /* 0: listing; 1: offer; 2: collection bid*/
  `price` decimal(12,4) NOT NULL DEFAULT 0,
  `order_created_date` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `order_expiration_date` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `order_event_timestamp` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `order_sent_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),        
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX (`contract_address`, `token_address`, `type`)
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
  `create_time` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX (`contract_address`, `status`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;