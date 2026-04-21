IF NOT EXISTS (SELECT 1 FROM BodyParts WHERE Name = 'Upper Body')
BEGIN
    INSERT INTO BodyParts (Name) VALUES ('Upper Body');
END;

IF NOT EXISTS (SELECT 1 FROM BodyParts WHERE Name = 'Lower Body')
BEGIN
    INSERT INTO BodyParts (Name) VALUES ('Lower Body');
END;
