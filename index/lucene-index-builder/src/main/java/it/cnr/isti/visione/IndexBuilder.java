package it.cnr.isti.visione;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.Charset;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Iterator;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;
import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.TokenStream;
import org.apache.lucene.analysis.Tokenizer;
import org.apache.lucene.analysis.core.WhitespaceTokenizer;
import org.apache.lucene.analysis.miscellaneous.DelimitedTermFrequencyTokenFilter;
import org.apache.lucene.document.Document;
import org.apache.lucene.document.Field;
import org.apache.lucene.document.FieldType;
import org.apache.lucene.document.StoredField;
import org.apache.lucene.document.TextField;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexOptions;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.IndexWriterConfig.OpenMode;
import org.apache.lucene.index.Term;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.Query;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.store.FSDirectory;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

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
                .description("Creates or adds to a Lucene index of a collection.");

        parser.addArgument("--save-every")
                .type(Integer.class)
                .setDefault(200)
                .help("commit index every this amount of indexed documents");

        parser.addArgument("-f", "--force")
                .action(new StoreTrueArgumentAction())
                .help("whether to replace existing document or skip insertion");

        parser.addArgument("documents_file").help("jsonl.gz file containing documents to be added");
        parser.addArgument("scenes_file").help("csv file containing scenes info");
        parser.addArgument("video_id").help("id of the video to which input documents belong");
        parser.addArgument("index_dir").help("directory in which the index is stored");
        Namespace ns = parser.parseArgsOrFail(args);

        int saveEvery = ns.getInt("save_every"); // TODO not used yet
        String documentsFile = ns.getString("documents_file");
        String scenesFile = ns.getString("scenes_file");
        String videoId = ns.getString("video_id");
        String indexDirectory = ns.getString("index_dir");
        boolean force = ns.getBoolean("force");

        // open the index dir
        Path absolutePath = Paths.get(indexDirectory, "");
        FSDirectory index = FSDirectory.open(absolutePath);

        // skip if documents of this video already exists
        Term videoIdTerm = new Term("videoID", videoId);

        if (!force) {
            IndexReader reader = DirectoryReader.open(index);
            IndexSearcher searcher = new IndexSearcher(reader);

            Query query = new TermQuery(videoIdTerm);
            long hits = searcher.search(query, 1).totalHits;
            if (hits > 0) {
                System.out.println("Found " + hits + " documents for video '" + videoId + "': skipping...");
                return;
            }
        }

        // configure index writer
        Analyzer analyzer = new TermFrequencyAnalyzer(); // parses "term1|freq1 term2|freq2 ..."
        IndexWriterConfig conf = new IndexWriterConfig(analyzer);
        conf.setOpenMode(OpenMode.CREATE_OR_APPEND);

        try (
            // documents file
            InputStream fileStream = new FileInputStream(documentsFile);
            InputStream gzipStream = new GZIPInputStream(fileStream);
            Reader decoder = new InputStreamReader(gzipStream, Charset.forName("UTF-8"));
            BufferedReader buffered = new BufferedReader(decoder);
            Stream<String> lines = buffered.lines();
            // scenes file
            Reader fileReader = new FileReader(scenesFile);
        ) {
            // iterates over json objects
            Iterator<JsonObject> cursor = lines.map(line -> JsonParser.parseString(line).getAsJsonObject()).iterator();

            // iterates over csv lines (line = scene)
            CSVFormat csvParser = CSVFormat.Builder.create(CSVFormat.DEFAULT).setHeader().setSkipHeaderRecord(true).build();
            Iterator<CSVRecord> scenes = csvParser.parse(fileReader).iterator();

            int count = 0; // TODO
            try (
                IndexWriter writer = new IndexWriter(index, conf);
                ProgressBar pb = new ProgressBar("Indexing", count)
            ) {
                // delete all existing documents for this video (if any)
                writer.deleteDocuments(videoIdTerm);

                // iterate and add all other docs
                while (cursor.hasNext()) {
                    JsonObject entry = cursor.next();
                    Document doc = new Document();
                    CSVRecord scene = scenes.next();

                    // ids
                    doc.add(new       Field("imgID"      , getString(entry, "_id"), storedTextFieldType));
                    doc.add(new StoredField("visioneid"  , getString(entry, "_id")));
                    doc.add(new       Field("videoID"    , videoId, storedTextFieldType));
                    doc.add(new StoredField("collection" , "collection"));  // TODO: deprecate

                    // frame info
                    int startFrame = Integer.parseInt(scene.get("Start Frame"));
                    int endFrame = Integer.parseInt(scene.get("End Frame"));
                    int middleFrame = (startFrame + endFrame) / 2;
                    doc.add(new StoredField("startframe" , startFrame));
                    doc.add(new StoredField("endframe"   , endFrame));
                    doc.add(new StoredField("middleframe", middleFrame));

                    double startTime = Double.parseDouble(scene.get("Start Time (seconds)"));
                    double endTime = Double.parseDouble(scene.get("End Time (seconds)"));
                    double middleTime = (startTime + endTime) / 2;
                    doc.add(new StoredField("starttime"  , startTime));
                    doc.add(new StoredField("endtime"    , endTime));
                    doc.add(new StoredField("middletime" , middleTime));

                    // static analyses
                    doc.add(new StoredField("cluster_code", get(entry, "cluster_code", "")));

                    // object fields
                    doc.add(new       Field("txt"        , get(entry, "object_box_str"  , ""), surrogateTextFieldType));
                    doc.add(new       Field("objects"    , get(entry, "object_count_str", ""), surrogateTextFieldType));
                    doc.add(new StoredField("objectsinfo", get(entry, "object_info"     , "")));

                    // features
                    doc.add(new       Field("features"   , get(entry, "features_gem_str", ""), surrogateTextFieldType));
                    doc.add(new       Field("aladin"     , get(entry, "features_aladin_str", ""), surrogateTextFieldType));

                    writer.addDocument(doc);
                    pb.step();
                }
            }
        }
    }

    // helper methods for accessing JsonObject
    protected static String getString(JsonObject element, String memberName) { return element.get(memberName).getAsString(); }
    protected static int    getInt   (JsonObject element, String memberName) { return element.get(memberName).getAsInt()   ; }
    protected static double getDouble(JsonObject element, String memberName) { return element.get(memberName).getAsDouble(); }
    // with default values
    protected static String get(JsonObject element, String memberName, String defaultValue) { return element.has(memberName) ? element.get(memberName).getAsString() : defaultValue; }
    protected static int    get(JsonObject element, String memberName, int    defaultValue) { return element.has(memberName) ? element.get(memberName).getAsInt()    : defaultValue; }
    protected static double get(JsonObject element, String memberName, double defaultValue) { return element.has(memberName) ? element.get(memberName).getAsDouble() : defaultValue; }
}
