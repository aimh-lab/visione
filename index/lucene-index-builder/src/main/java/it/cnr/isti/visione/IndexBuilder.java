package it.cnr.isti.visione;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.TokenStream;
import org.apache.lucene.analysis.Tokenizer;
import org.apache.lucene.analysis.core.WhitespaceTokenizer;
import org.apache.lucene.analysis.miscellaneous.DelimitedTermFrequencyTokenFilter;
import org.apache.lucene.document.Field;
import org.apache.lucene.document.FieldType;
import org.apache.lucene.document.StoredField;
import org.apache.lucene.document.TextField;
import org.apache.lucene.index.IndexOptions;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.IndexWriterConfig.OpenMode;
import org.apache.lucene.store.FSDirectory;
import org.bson.Document;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;

import me.tongfei.progressbar.ProgressBar;
import net.sourceforge.argparse4j.ArgumentParsers;
import net.sourceforge.argparse4j.impl.action.StoreTrueArgumentAction;
import net.sourceforge.argparse4j.inf.ArgumentParser;
import net.sourceforge.argparse4j.inf.Namespace;

public class IndexBuilder {

    /* Whitespace Analyzer + DelimitedTermFrequencyTokenFilter */
    protected static class TermFrequencyAnalyzer extends Analyzer {

        @Override
        protected TokenStreamComponents createComponents(String fieldName) {
            Tokenizer source = new WhitespaceTokenizer();
            TokenStream result = new DelimitedTermFrequencyTokenFilter(source);
            return new TokenStreamComponents(source, result);
        }

    }

    /* FieldType for Stored Searchable Fields */
    protected static FieldType storedTextFieldType = new FieldType(TextField.TYPE_STORED) {{
        setIndexOptions(IndexOptions.DOCS);
        setOmitNorms(true);
    }};

    /* FieldType for Surrogate Text Representation Fields */
    protected static FieldType surrogateTextFieldType = new FieldType(TextField.TYPE_NOT_STORED) {{
        setIndexOptions(IndexOptions.DOCS_AND_FREQS);
        setStoreTermVectors(true);
    }};

    public static void main(String[] args) throws IOException {
        ArgumentParser parser = ArgumentParsers.newFor("IndexBuilder").build()
                .defaultHelp(true)
                .description("Create a Lucene index of a collection.");

        parser.addArgument("--mongo-uri")
                .help("mongodb connection string (e.g., \"mongodb://admin:visione@mongo/\")")
                .setDefault("mongodb://admin:visione@mongo/");
        parser.addArgument("-a", "--append")
                .help("appends to an existing index instead of truncating it")
                .action(new StoreTrueArgumentAction());
        parser.addArgument("database_name").help("db name in mongo containing the collection to be indexed");
        parser.addArgument("index_dir").help("directory in which the index is created");
        Namespace ns = parser.parseArgsOrFail(args);

        String mongoUri = ns.getString("mongo_uri");
        String databaseName = ns.getString("database_name");
        String outputIndexDirectory = ns.getString("index_dir");
        boolean append = ns.getBoolean("append");
        String indexCollection = "frames";

        // open the index dir
        Path absolutePath = Paths.get(outputIndexDirectory, "");
        FSDirectory index = FSDirectory.open(absolutePath);

        // configure index writer
        Analyzer analyzer = new TermFrequencyAnalyzer(); // parses "term1|freq1 term2|freq2 ..."
        IndexWriterConfig conf = new IndexWriterConfig(analyzer);
        OpenMode openMode = (append) ? OpenMode.CREATE_OR_APPEND : OpenMode.CREATE;
        conf.setOpenMode(openMode);

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(databaseName);
            int count = database.runCommand(new Document("collStats", "frames")).getInteger("count");

            MongoCollection<Document> collection = database.getCollection(indexCollection);
            try (
                MongoCursor<Document> cursor = collection.find().cursor();
                IndexWriter writer = new IndexWriter(index, conf);
                ProgressBar pb = new ProgressBar("Indexing", count)
            ) {
                while (cursor.hasNext()) {
                    Document entry = cursor.next();
                    org.apache.lucene.document.Document doc = new org.apache.lucene.document.Document();

                    // ids
                    doc.add(new       Field("imgID"      , entry.getString("_id"), storedTextFieldType));
                    doc.add(new StoredField("visioneid"  , entry.getString("_id")));
                    doc.add(new StoredField("videoID"    , entry.getString("video_id")));
                    doc.add(new StoredField("collection" , databaseName));

                    // frame info
                    doc.add(new StoredField("startframe" , entry.getInteger("start_frame")));
                    doc.add(new StoredField("endframe"   , entry.getInteger("end_frame"  )));
                    doc.add(new StoredField("middleframe", entry.getInteger("key_frame"  )));

                    doc.add(new StoredField("starttime"  , entry. getDouble("start_time")));
                    doc.add(new StoredField("endtime"    , entry. getDouble("end_time"  )));
                    doc.add(new StoredField("middletime" , entry. getDouble("key_time"  )));

                    // static analyses
                    doc.add(new StoredField("cluster_code", entry.get("cluster_code", "")));

                    // object fields
                    doc.add(new       Field("txt"        , entry.get("object_box_str"  , ""), surrogateTextFieldType));
                    doc.add(new       Field("objects"    , entry.get("object_count_str", ""), surrogateTextFieldType));
                    doc.add(new StoredField("objectsinfo", entry.get("object_info"     , "")));

                    // features
                    doc.add(new       Field("features"   , entry.get("features_gem_str", ""), surrogateTextFieldType));
                    doc.add(new       Field("aladin"     , entry.get("features_aladin_str", ""), surrogateTextFieldType));

                    writer.addDocument(doc);
                    pb.step();
                }
            }
        }
    }
}
