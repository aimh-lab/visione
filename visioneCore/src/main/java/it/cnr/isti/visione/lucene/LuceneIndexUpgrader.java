package it.cnr.isti.visione.lucene;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.IndexUpgrader;
import org.apache.lucene.store.Directory;
import org.apache.lucene.store.FSDirectory;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

public class LuceneIndexUpgrader {

    public static void main(String[] args) {
        String indexPath = "/media/ssd2/data/vbs2023/v3c_index";
        
        try {
            Path indexDir = Paths.get(indexPath);
            Directory directory = FSDirectory.open(indexDir);
            IndexWriterConfig config = new IndexWriterConfig();
            IndexWriter writer = new IndexWriter(directory, config);
            IndexUpgrader upgrader = new IndexUpgrader(directory);
            upgrader.upgrade();
            writer.commit();
            writer.close();
            System.out.println("Indice aggiornato con successo.");
        } catch (IOException e) {
            System.out.println("Si è verificato un errore durante l'aggiornamento dell'indice: " + e.getMessage());
        }
    }
}