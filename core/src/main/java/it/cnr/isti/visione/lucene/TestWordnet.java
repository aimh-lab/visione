package it.cnr.isti.visione.lucene;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.text.ParseException;
import java.util.Comparator;

import org.apache.lucene.analysis.CharArraySet;
import org.apache.lucene.analysis.standard.StandardAnalyzer;
import org.apache.lucene.analysis.synonym.SynonymFilter;
import org.apache.lucene.analysis.synonym.SynonymMap;
import org.apache.lucene.analysis.synonym.WordnetSynonymParser;
import org.apache.lucene.util.BytesRef;
import org.apache.lucene.util.BytesRefBuilder;
import org.apache.lucene.util.IntsRef;
import org.apache.lucene.util.IntsRefBuilder;
import org.apache.lucene.util.fst.Util;

public class TestWordnet {
    private final static String WORDNET_SYNONYMS = "wn_s.pl";

    public static void main(String[] pArgs) throws IOException, ParseException {
        try (Reader reader = new BufferedReader(new InputStreamReader(TestWordnet.class.getResourceAsStream(WORDNET_SYNONYMS)))) {
            WordnetSynonymParser parser = new WordnetSynonymParser(true, true, new StandardAnalyzer(CharArraySet.EMPTY_SET));
            parser.parse(reader);//  w   w   w.   d   e  mo  2  s    . c   om  
            SynonymMap syns = parser.build();
            SynonymFilter filter;
            /*
            Arc<BytesRef> firstArc = syns.fst.getFirstArc(new Arc<BytesRef>());
             Util.TopResults<BytesRef> paths[] = Util.shortestPaths(syns.fst, firstArc, new Comparator<BytesRef>(){
                
               @Override
               public int compare(BytesRef arg0, BytesRef arg1) {
                  // TODO Auto-generated method stub
                  return 0;
               }
                    
             }, 2, false);
             System.out.println(Util.toBytesRef(paths[0].input, scratchBytes).utf8ToString()); // cat
             System.out.println(paths[0].output); // 5
             System.out.println(Util.toBytesRef(paths[1].input, scratchBytes).utf8ToString()); // dog
             System.out.println(paths[1].output); // 7
            */

            BytesRef output = Util.get(syns.fst, Util.toUTF32("dog", new IntsRefBuilder()));
            System.out.println("output: " + Util.toIntsRef(output, new IntsRefBuilder()));            
            output = Util.get(syns.fst, Util.toUTF32("cat", new IntsRefBuilder()));
            System.out.println("output: " + Util.toIntsRef(output, new IntsRefBuilder()));

            // Like TermsEnum, this also supports seeking (advance)
            /*
             BytesRefFSTEnum<BytesRef> iterator = new BytesRefFSTEnum<>(syns.fst);
             while (iterator.next() != null) {
               InputOutput<BytesRef> mapEntry = iterator.current();
               System.out.println(mapEntry.input.utf8ToString());
               System.out.println(mapEntry.output);
             }
             */
        }
    }
}