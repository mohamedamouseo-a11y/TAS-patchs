CREATE TABLE IF NOT EXISTS `in_app_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `type` enum('meeting_reminder','lead_assigned','sla_breach','lead_transfer','mention','system','stage_change','deal_won','deal_lost','activity_logged','lead_quality_change','duplicate_lead','bulk_import','data_edit','data_delete','data_restore','data_undo','new_lead','lead_distribution','campaign_alert','deal_update','contract_renewal','reminder','follow_up_reminder','internal_note') NOT NULL DEFAULT 'system',
  `title` varchar(500) NOT NULL,
  `titleAr` varchar(500) DEFAULT NULL,
  `body` text,
  `bodyAr` text,
  `isRead` tinyint NOT NULL DEFAULT 0,
  `link` varchar(500) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`)
);
